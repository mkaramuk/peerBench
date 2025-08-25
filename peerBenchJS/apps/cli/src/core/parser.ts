import { z } from "zod";
import { logger } from "./logger";

/**
 * Tries to parse the given string as JSON.
 * Returns undefined if it is not a valid JSON entity.
 */
export function tryParseJson<T = any>(content: string): T | undefined {
  try {
    return JSON.parse(content);
  } catch {
    // Invalid JSON
  }
}

/**
 * Parses provider and model config which follow the pattern below:
 * <provider name>:<model identifier (depends on the provider)>
 * @returns Provider name and model identifier
 */
export function parseProviderConfig(identifier: string) {
  const regex = /^([^:]+):(.+)$/;
  const match = identifier.match(regex);
  if (!match) {
    logger.warning(`Invalid provider config: ${identifier}`);
    return;
  }

  const [, name, modelIdentifier] = match;
  return {
    providerName: name,
    modelIdentifier,
  };
}

/**
 * Parses JSONL formatted string into an array
 * @returns An array of parsed JSON lines
 */
export function parseJSONL<T>(str: string): T[] {
  return str
    .split("\n") // Split per line
    .filter((line) => line.trim() !== "") // Filter empty lines
    .map((line) => tryParseJson(line)) // Parse line (parse as undefined if it is invalid)
    .filter((obj) => obj !== undefined); // Filter invalid lines
}

/**
 * Extracts the first error message (if there is any)
 * from a Zod safe parse result and format it.
 * @param safeParseReturn
 * @param path Path of the parsing object. It will be used to indicate the invalid field if the info is not available in the validation error.
 */
export function parseValidationError<T, K>(
  safeParseReturn: z.SafeParseReturnType<T, K>,
  path?: string
) {
  path ??= "";

  if (safeParseReturn?.error) {
    const firstError = safeParseReturn.error.errors[0];

    if (path) {
      path = `${path}: `;
    }

    // Include path if there is
    path =
      firstError.path.length > 0 ? `"${firstError.path.join(".")}": ` : path;
    return `${path}${firstError.message}`;
  }
}

/**
 * Parses provider name from a DID definition
 */
export function parseProviderDID(did: string) {
  return did.split(":")[2];
}

/**
 * Parses task name from a DID definition
 */
export function parseTaskDID(did: string) {
  return did.split(":")[2];
}

/**
 * Parses model name (including owner name) from a DID model definition
 */
export function parseModelDID(did: string) {
  const parts = did.split(":").slice(2);

  // Model name includes ':' character
  if (parts.length > 2) {
    return parts.join(":");
  }
  return parts.join("");
}

/**
 * Parses `did:<entity>:<content>` format text and returns the content part
 */
export function parseDIDPrefix(did: string) {
  const parts = did.split(":").slice(2);

  if (parts.length > 2) {
    return parts.join(":");
  }
  return parts.join("");
}
