import { parseEnvVariables } from "@/config";
import { logger } from "@/core/logger";
import { MaybePromise, ModelResponse } from "@/types";
import winston from "winston";
import { z } from "zod";

/**
 * Base class for Providers
 */
export abstract class AbstractProvider<
  T extends Record<string, z.ZodTypeAny> = Record<string, z.ZodTypeAny>,
> {
  readonly name: string;

  logger: winston.Logger;
  env: { [K in keyof T]: z.infer<T[K]> };

  /**
   * Initialize a new Provider
   * @param options
   */
  constructor(options: {
    /**
     * Name of the provider
     */
    name: string;

    env?: T;
  }) {
    this.name = options.name;
    this.env = {} as T;

    try {
      const capitalizedName = options.name.replace(".", "_").toUpperCase();

      if (options.env !== undefined) {
        const env: Record<string, z.ZodTypeAny> = {};
        const originalKeys: Record<string, keyof T> = {};

        for (const [key, schema] of Object.entries(options.env)) {
          const envKey = `PB_${capitalizedName}_${key}`;

          originalKeys[envKey] = key;
          env[envKey] = schema;
        }

        const parsedEnv = parseEnvVariables(env);

        for (const [key, value] of Object.entries(parsedEnv)) {
          this.env[originalKeys[key] as keyof T] = value;
        }
      }

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
    return `did:prov:${this.name.toLowerCase()}`;
  }

  /**
   * Executes the given prompt and returns the response
   * @param prompt
   */
  abstract forward(
    prompt: string,
    model: string,
    system: string
  ): Promise<ModelResponse>;

  abstract parseModelIdentifier(identifier: string): MaybePromise<{
    modelName: string;
    modelOwner: string;
    subProvider?: string;
  }>;
}
