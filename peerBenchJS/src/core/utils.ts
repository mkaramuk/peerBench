import { ByteView, CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
import * as json from "multiformats/codecs/json";
import * as raw from "multiformats/codecs/raw";
import { readFileSync, statSync, writeFileSync } from "fs";
import { parseValidationError } from "./parser";
import { z } from "zod";
import { config } from "@/config";

export function readableTime(totalSeconds: number) {
  if (totalSeconds >= 86400) {
    const days = Math.floor(totalSeconds / 86400);
    return days.toFixed(2) + (days === 1 ? " day" : " days");
  }
  // Otherwise, if there are at least 3600 seconds, show hours only.
  else if (totalSeconds >= 3600) {
    const hours = Math.floor(totalSeconds / 3600);
    return hours.toFixed(2) + (hours === 1 ? " hour" : " hours");
  }
  // Otherwise, if there are at least 60 seconds, show minutes only.
  else if (totalSeconds >= 60) {
    const minutes = Math.floor(totalSeconds / 60);
    return minutes.toFixed(2) + (minutes === 1 ? " minute" : " minutes");
  }
  // Otherwise, show seconds.
  else {
    return (
      totalSeconds.toFixed(2) + (totalSeconds === 1 ? " second" : " seconds")
    );
  }
}

export async function sleep(ms: number) {
  return await new Promise<void>((res) => setTimeout(res, ms));
}

export async function generateCID(data: unknown) {
  let bytes: ByteView<unknown>;

  if (typeof data === "object") {
    bytes = json.encode(data);
  } else {
    bytes = new TextEncoder().encode(`${data}`);
  }

  const hash = await sha256.digest(bytes);
  const cid = CID.create(
    1,
    typeof data === "object" ? json.code : raw.code,
    hash
  );

  return cid;
}

export function readFile(path: string) {
  if (!statSync(path, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`File doesn't exist: ${path}`);
  }

  return readFileSync(path, { encoding: "utf-8" }).toString();
}

export function checkValidationError<T, K>(
  safeParseReturn: z.SafeParseReturnType<T, K>,
  path?: string
) {
  if (safeParseReturn?.error) {
    throw new Error(parseValidationError(safeParseReturn, path));
  }

  return safeParseReturn.data;
}

export async function signFile(filePath: string, hash: string) {
  const signature = await config.VALIDATOR_ACCOUNT.signMessage({
    message: hash,
  });

  writeFileSync(`${filePath}.signature`, signature, {
    encoding: "utf-8",
  });
}

export async function hashFile(filePath: string) {
  const content = readFile(filePath);
  const cid = await generateCID(content);

  writeFileSync(`${filePath}.cid`, cid.toString(), {
    encoding: "utf-8",
  });

  return cid.toString();
}

export function randomInteger(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
