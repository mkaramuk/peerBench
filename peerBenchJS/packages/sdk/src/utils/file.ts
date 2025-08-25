/**
 * Reads the file and returns the content as a string.
 * @param path - The path to the file.
 * @returns The content of the file as a string.
 */
export async function readFile(path: string): Promise<ArrayBuffer> {
  if (typeof window === "undefined") {
    // Node.js environment
    const { readFileSync, statSync } = await import("node:fs");
    if (!statSync(path, { throwIfNoEntry: false })?.isFile()) {
      throw new Error(`File doesn't exist: ${path}`);
    }
    const buffer = readFileSync(path);
    const arrayBuffer = new ArrayBuffer(buffer.length);
    const view = new Uint8Array(arrayBuffer);
    view.set(buffer);
    return arrayBuffer;
  } else {
    // Browser environment
    throw new Error(
      "File system operations are not supported in browser environment. Use readFromContent instead."
    );
  }
}

/**
 * Converts an ArrayBuffer to a string
 * @param buffer - The ArrayBuffer to convert
 * @returns The string representation of the buffer
 */
export function bufferToString(buffer: ArrayBuffer): string {
  const decoder = new TextDecoder();
  return decoder.decode(buffer);
}

/**
 * Converts a string to an ArrayBuffer
 * @param str - The string to convert
 * @returns The ArrayBuffer representation of the string
 */
export function stringToBuffer(str: string): ArrayBuffer {
  const encoder = new TextEncoder();
  return encoder.encode(str).buffer as ArrayBuffer;
}
