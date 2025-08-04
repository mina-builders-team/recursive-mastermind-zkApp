import { PublicKey, UInt64 } from 'o1js';

const GAME_FEE = UInt64.from(2 * 1e9);
const PER_TURN_GAME_DURATION = 2;
const MAX_ATTEMPTS = 7;
const REFEREE_PUBKEY = PublicKey.fromBase58(
  'B62qnbdBnbKMC1VJ9unXX9k8JfBNs4HPvo6t4rUWb43cG1bPcPEQCC5'
);

export { PER_TURN_GAME_DURATION, MAX_ATTEMPTS, REFEREE_PUBKEY, GAME_FEE };
