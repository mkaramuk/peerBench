export function cryptoRandom() {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
}
