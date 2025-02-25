import { Field, Bool, Provable, UInt64, UInt32 } from 'o1js';

export {
  separateCombinationDigits,
  compressCombinationDigits,
  validateCombination,
  serializeClue,
  deserializeClue,
  getClueFromGuess,
  checkIfSolved,
  compressTurnCountMaxAttemptSolved,
  separateTurnCountAndMaxAttemptSolved,
  compressRewardAndFinalizeSlot,
  separateRewardAndFinalizeSlot,
};

/**
 * Separates a four-digit Field value into its individual digits.
 *
 * @param combination - The four-digit Field to be separated.
 * @returns An array of four Field digits representing the separated digits.
 *
 * @throws Will throw an error if the combination is not a four-digit number.
 *
 * @note The function first asserts that the input is a valid four-digit Field.
 *       The digits are then witnessed, and their correctness is asserted by re-compressing
 *       them back into the original combination and ensuring equality.
 */
function separateCombinationDigits(combination: Field) {
  // Assert that the combination is a four-digit Field
  const isFourDigit = combination
    .greaterThanOrEqual(1000)
    .and(combination.lessThanOrEqual(9999));
  isFourDigit.assertTrue('The combination must be a four-digit Field!');

  // Witness single digits of the combination
  const digits = Provable.witness(Provable.Array(Field, 4), () => {
    const num = combination.toBigInt();
    return [num / 1000n, (num / 100n) % 10n, (num / 10n) % 10n, num % 10n];
  });

  // Assert the correctness of the witnessed digit separation
  compressCombinationDigits(digits).assertEquals(combination);

  return digits;
}

/**
 * Combines an array of four digits into a single Field value.
 *
 * @note An additional check to ensure that the input has exactly four digits would typically be necessary.
 * However, since this function is primarily used within {@link separateCombinationDigits}, the input is
 * already validated as a four-digit Field array by `Provable.Array(Field, 4)`, which inherently ensures the array has a length of 4.
 *
 * @param combinationDigits - An array of four Field digits.
 * @returns The combined Field element representing the original four-digit number.
 */
function compressCombinationDigits(combinationDigits: Field[]) {
  return combinationDigits[0]
    .mul(1000)
    .add(combinationDigits[1].mul(100))
    .add(combinationDigits[2].mul(10))
    .add(combinationDigits[3]);
}

/**
 * Validates the combination digits to ensure they meet the game rules.
 *
 * @param combinationDigits - An array of four Field digits representing the combination.
 *
 * @throws Will throw an error if any digit (except the first) is 0 or if any digits are not unique.
 *
 * @note The first digit is not checked for 0 because it would reduce the combination to a 3-digit value.
 *       The combination digits are provided by {@link separateCombinationDigits}, which ensures they form
 *       a valid four-digit number.
 */
function validateCombination(combinationDigits: Field[]) {
  for (let i = 1; i < 4; i++) {
    // Ensure the digit is not zero (only for digits 2, 3, and 4)
    combinationDigits[i]
      .equals(0)
      .assertFalse(`Combination digit ${i + 1} should not be zero!`);

    // Ensure the digits are unique
    for (let j = i; j < 4; j++) {
      combinationDigits[i - 1].assertNotEquals(
        combinationDigits[j],
        `Combination digit ${j + 1} is not unique!`
      );
    }
  }
}

/**
 * Serializes an array of Field elements representing a clue into a single Field
 * Each clue element is converted to 2 bits and then combined into a single dField.
 *
 * @param clue - An array of 4 Field elements, each representing a part of the clue.
 * @returns - A single Field representing the serialized clue.
 */
function serializeClue(clue: Field[]): Field {
  const clueBits = clue.map((f) => f.toBits(2)).flat();
  const serializedClue = Field.fromBits(clueBits);

  return serializedClue;
}

/**
 * Deserializes a Field into an array of Field elements, each representing a part of the clue.
 * The serialized clue is split into 2-bit segments to retrieve the original clue elements.
 *
 * @note This function is not used within a zkApp itself but is utilized for reading and deserializing
 * on-chain stored data, as well as verifying integrity during integration tests.
 *
 * @param serializedClue - A Field representing the serialized clue.
 * @returns - An array of 4 Field elements representing the deserialized clue.
 */
function deserializeClue(serializedClue: Field): Field[] {
  const bits = serializedClue.toBits(8);
  const clueA = Field.fromBits(bits.slice(0, 2));
  const clueB = Field.fromBits(bits.slice(2, 4));
  const clueC = Field.fromBits(bits.slice(4, 6));
  const clueD = Field.fromBits(bits.slice(6, 8));

  return [clueA, clueB, clueC, clueD];
}

/**
 * Compares the guess with the solution and returns a clue indicating hits and blows.
 * A "hit" is when a guess digit matches a solution digit in both value and position.
 * A "blow" is when a guess digit matches a solution digit in value but not position.
 *
 * @param guess - The array representing the guessed combination.
 * @param solution - The array representing the correct solution.
 * @returns - An array where each element represents the clue for a corresponding guess digit.
 *                           2 indicates a "hit" and 1 indicates a "blow".
 */
function getClueFromGuess(guess: Field[], solution: Field[]) {
  let clue = Array.from({ length: 4 }, () => Field(0));

  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const isEqual = guess[i].equals(solution[j]).toField();
      if (i === j) {
        clue[i] = clue[i].add(isEqual.mul(2)); // 2 for a hit (correct digit and position)
      } else {
        clue[i] = clue[i].add(isEqual); // 1 for a blow (correct digit, wrong position)
      }
    }
  }

  return clue;
}

/**
 * Determines if the secret combination is solved based on the given clue.
 *
 * @param clue - An array representing the clues for each guess.
 * @returns Returns true if all clues indicate a "hit" (2), meaning the secret is solved.
 */
function checkIfSolved(clue: Field[]) {
  let isSolved = Bool(true);

  for (let i = 0; i < 4; i++) {
    let isHit = clue[i].equals(2);
    isSolved = isSolved.and(isHit);
  }

  return isSolved;
}

/**
 * Combines the turn count, max attempt, and solved flag into a single Field value.
 *
 * @param digits - An array of three Field elements representing the turn count, max attempt, and solved flag.
 * @returns - The combined Field element representing the compressed turn count, max attempt, and solved flag.
 */
function compressTurnCountMaxAttemptSolved(digits: Field[]) {
  digits[0].assertLessThan(100, 'Turn count must be less than 100!');
  digits[1].assertLessThan(100, 'Max attempt must be less than 100!');
  digits[2].assertLessThan(2, 'Solved flag must be less than 2!');

  return digits[0].mul(10000).add(digits[1].mul(100).add(digits[2]));
}

/**
 * Separates the turn count and max attempt from a single Field value.
 *
 * @param value - The Field value to be separated into turn count and max attempt.
 * @returns - An array of two Field elements representing the separated turn count and max attempt.
 */
function separateTurnCountAndMaxAttemptSolved(value: Field) {
  const digits = Provable.witness(Provable.Array(Field, 3), () => {
    const num = value.toBigInt();

    return [num / 10000n, (num / 100n) % 100n, num % 100n];
  });

  compressTurnCountMaxAttemptSolved(digits).assertEquals(value);

  return digits;
}

function compressRewardAndFinalizeSlot(
  rewardAmount: UInt64,
  finalizeSlot: UInt32
) {
  return rewardAmount.value.mul(2 ** 32).add(finalizeSlot.value);
}

function separateRewardAndFinalizeSlot(value: Field) {
  const digits = Provable.witness(Provable.Array(UInt32, 3), () => {
    const num = value.toBigInt();
    return [
      UInt32.from(num / 18446744073709551616n),
      UInt32.from((num / 4294967296n) % 4294967296n),
      UInt32.from(num % 4294967296n),
    ];
  });

  let rewardAmount = UInt64.from(digits[0])
    .mul(2 ** 32)
    .add(UInt64.from(digits[1]));
  let finalizeSlot = digits[2];

  compressRewardAndFinalizeSlot(rewardAmount, finalizeSlot).assertEquals(value);

  return { rewardAmount, finalizeSlot };
}
