import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
import * as json from "multiformats/codecs/json";

/**
 * Calculates the CID of the given data
 */
export async function calculateCID(data: unknown) {
  const bytes = json.encode(data);

  const hash = await sha256.digest(bytes);
  const cid = CID.create(1, json.code, hash);

  return cid;
}
