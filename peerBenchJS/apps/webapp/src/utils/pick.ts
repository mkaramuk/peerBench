/* eslint-disable @typescript-eslint/no-explicit-any */
import { cryptoRandom } from "./crypto-random";

export function pickRandomItem<T>(array: T[]): T {
  return array[Math.floor(cryptoRandom() * array.length)];
}

export function pickRandomField<T extends Record<any, any>>(obj: T) {
  const keys = Object.keys(obj) as (keyof T)[];
  const key = pickRandomItem(keys);
  return { key, value: obj[key] };
}
