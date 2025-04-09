import { parseEnvVariables } from "@/config";
import { logger } from "@/core/logger";
import { ModelResponse } from "@/types";
import winston from "winston";
import { z } from "zod";

/**
 * Base class for Providers
 */
export abstract class AbstractProvider {
  readonly name: string;

  logger: winston.Logger;
  apiKey: string;

  /**
   * Initialize a new Provider
   * @param options
   */
  constructor(options: {
    /**
     * Name of the provider
     */
    name: string;
  }) {
    this.name = options.name;

    try {
      const capitalizedName = options.name.replace(".", "_").toUpperCase();
      const apiKeyEnvName = `PB_${capitalizedName}_KEY`;
      const env = parseEnvVariables({
        [apiKeyEnvName]: z.string().nonempty(),
      });

      this.apiKey = env[apiKeyEnvName]!;

      this.logger = logger.child({
        context: `Provider(${this.name})`,
      });
    } catch (err: any) {
      throw new Error(`${this.name}: ${err?.message || err}`, {
        cause: err,
      });
    }
  }

  /**
   * Decentralized identifier of the Provider
   */
  get did() {
    return `did:pb:${this.name.toLowerCase()}`;
  }

  /**
   * Executes the given prompt and returns the response
   * @param prompt
   */
  abstract forward(prompt: string, model: string): Promise<ModelResponse>;
}
