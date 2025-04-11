import { z } from "zod";
import { logger } from "./logger";
import { providers } from "./providers";

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
 * Parses a provider and model identifier which follows up the pattern below:
 * <provider name>:<model owner>/<model name>
 * @returns Provider name, model name (combined model name and owner) and instance of provider implementation
 */
export function parseIdentifier(identifier: string) {
  const parts = identifier.split(":");
  const providerName = parts[0];
  let model = "";

  // If the model name includes ":" we need to join the string together with ":" character
  if (parts.length > 2) {
    model = parts.slice(1).join(":");
  } else {
    model = parts.slice(1).join("");
  }

  if (providerName === undefined || model === undefined) {
    logger.warning(`Invalid identifier: ${identifier}`);
    return;
  }

  const provider = providers.find((p) => p.name === providerName);
  if (provider === undefined) {
    logger.warning(`Provider not found: ${provider}`);
    return;
  }

  return {
    name: providerName,
    model,
    provider,
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
 * Parses provider name from a DID provider definition
 */
export function parseProviderDID(did: string) {
  return did.split(":")[2];
}

/**
 * Parses evaluation name from a DID definition (yes it is the same thing as `parseProviderDID`)
 */
export function parseEvaluationDID(did: string) {
  return did.split(":")[2];
}

/**
 * Parses the model name (including owner name) from a DID model definition
 */
export function parseModelDID(did: string) {
  const parts = did.split(":").slice(2);

  // Model name includes ':' character
  if (parts.length > 2) {
    return parts.join(":");
  }
  return parts.join("");
}
