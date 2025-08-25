import { ByteView, CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
import * as json from "multiformats/codecs/json";
import * as raw from "multiformats/codecs/raw";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "fs";
import { parseValidationError } from "./parser";
import { z } from "zod";
import { config } from "@/config";
import { join, ParsedPath, parse as parsePath } from "path";
import * as csv from "csv";

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

export async function generateSignatureFile(
  filePath: string,
  signatureMessage: string
) {
  const signature = await config.VALIDATOR_ACCOUNT.signMessage({
    message: signatureMessage,
  });

  writeFileSync(`${filePath}.signature`, signature, {
    encoding: "utf-8",
  });

  return signature;
}

export async function generateCIDFile(sourceFilePath: string) {
  const content = readFile(sourceFilePath);
  const cid = await generateCID(content);

  writeFileSync(`${sourceFilePath}.cid`, cid.toString(), {
    encoding: "utf-8",
  });

  return cid.toString();
}

export function randomInteger(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Returns the newest file path from the given paths.
 * Also works with directories.
 */
export function getLatestFile(paths: string[]) {
  const files: { path: string; date: Date }[] = paths.map((p) => ({
    path: p,
    date: statSync(p).mtime,
  }));

  files.sort((a, b) => b.date.getTime() - a.date.getTime());
  return files[0]?.path;
}

/**
 * Recursively walks the given path until reaching the given depth.
 * Then returns the files inside that depth recursively.
 * @param path
 * @param options
 * @returns
 */
export function goIntoDir(
  path: string,
  options: {
    filter: (pathInfo: ParsedPath) => boolean;
    map?: (files: string[]) => string[];
    depth: number;
  }
) {
  if (options.depth == 0) {
    const files = readdirSync(path, { recursive: true });
    const processed = files
      .map((fil) => join(path, fil.toString()))
      .filter((fil) => options.filter(parsePath(fil)));
    return options.map ? options.map(processed) : processed;
  }

  const files: string[] = [];
  const dirFiles = readdirSync(path);
  for (const dirFile of dirFiles) {
    const fullPath = join(path, dirFile.toString());
    if (statSync(fullPath, { throwIfNoEntry: false })?.isDirectory()) {
      files.push(
        ...goIntoDir(fullPath, {
          depth: options.depth - 1,
          filter: options.filter,
          map: options.map,
        })
      );
    }
  }

  return files;
}

/**
 * Saves the given entity (array, object, primitive etc.) into the output directory (or the path) as JSON or CSV formatted file.
 * Also creates hash & signature files for the newly created file.
 * @returns Path of the saved file
 */
export async function saveEntity<T>(
  entity: T,
  type: "json" | "csv",
  options: {
    fileNamePrefix?: string | (() => string);
    fileNameSuffix?: string | (() => string);
    dirPath?: string;
    path?: string;
    hash?: boolean;
    sign?: boolean;
  }
) {
  let prefix: () => string;
  let suffix: () => string;

  if (typeof options.fileNamePrefix === "function") {
    prefix = options.fileNamePrefix;
  } else {
    prefix = () => (options.fileNamePrefix as string) || "file";
  }

  if (typeof options.fileNameSuffix === "function") {
    suffix = options.fileNameSuffix;
  } else {
    suffix = () => (options.fileNameSuffix as string) || Date.now.toString();
  }

  const path =
    options.path ||
    join(
      ...[
        config.OUTPUT_DIR,
        options.dirPath,
        `${prefix()}-${suffix()}.${type}`,
      ].filter<string>((p) => p !== undefined)
    );

  let data = "";
  if (type === "csv" && Array.isArray(entity)) {
    data = await new Promise<string>((res, rej) => {
      csv.stringify(
        entity,
        { quoted_string: true, header: true },
        (err, out) => {
          if (err) {
            return rej(err);
          }
          res(out);
        }
      );
    });
  } else {
    data = JSON.stringify(entity, null, 2);
  }

  writeFileSync(path, data, {
    encoding: "utf-8",
  });

  if (options.hash) {
    const hash = await generateCIDFile(path);
    if (options.sign) {
      await generateSignatureFile(path, hash);
    }
  }

  return path;
}

/**
 * Saves job log under `data/logs` directory
 */
export async function saveJobLog<T>(
  entity: T,
  jobType: "prompt" | "score" | "aggregate" | "upload" | "rephrase" | "std",
  timestamp: string | number
) {
  const dirPath = join(config.DATA_DIR, "logs");
  mkdirSync(dirPath, { recursive: true });

  return await saveEntity(entity, "json", {
    path: join(dirPath, `log-${jobType}-${timestamp}.json`),
  });
}

/**
 * Calculates CID of the given file and returns it
 */
export async function calculateFileCID(filePath: string): Promise<string> {
  const content = readFile(filePath);
  const cid = await generateCID(content);
  return cid.toString();
}

/**
 * Checks the thrown value and if it is not something
 * that inherited from Error, converts it to a plain Error object.
 * If it is something that inherited from Error then just returns it.
 */
export function ensureError(value: unknown): Error {
  if (value instanceof Error) return value;

  let stringified = "[Unable to stringify the thrown value]";
  try {
    stringified = JSON.stringify(value);
  } catch {
    // The value cannot be stringified.
  }

  const error = new Error(
    `This value was thrown as is, not through an Error: ${stringified}`
  );
  return error;
}

export async function csvStringify(entity: any[]) {
  return await new Promise<string>((res, rej) => {
    csv.stringify(entity, { quoted_string: true, header: true }, (err, out) => {
      if (err) {
        return rej(err);
      }
      res(out);
    });
  });
}
