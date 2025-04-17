import { z } from "zod";
import { red } from "ansis";
import dotenv from "@dotenvx/dotenvx";
import { join } from "path";
import { mkdirSync } from "fs";
import { LogLevels, NodeEnvs } from "./types";
import { Address, privateKeyToAccount } from "viem/accounts";

dotenv.config({ ignore: ["MISSING_ENV_FILE"], logLevel: "blank", quiet: true });

/**
 * Parses the environment variables based on the given fields.
 * Exits with code 1 if the parse is failed
 * @returns Parsed environment variables
 */
export function parseEnvVariables<T extends Record<string, z.ZodTypeAny>>(
  fields: T
): z.infer<z.ZodObject<T>> {
  const environmentSchema = z.object(fields);
  const validation = environmentSchema.safeParse(process.env, {});

  if (validation.error) {
    const error = validation.error.errors[0];
    const path = error.path.length > 0 ? error.path.join(".") + ": " : "";
    console.error(
      red(`Error while parsing environment variables: ${path}${error.message}`)
    );
    process.exit(1);
  }

  return validation.data;
}

// Parse variables
const env = parseEnvVariables({
  NODE_ENV: z.enum(NodeEnvs).default("dev"),
  LOG_LEVEL: z.enum(LogLevels).default("debug"),
  COOL_DOWN_INTERVAL: z.coerce.number().default(2000),
  PRIVATE_KEY: z.string().nonempty(),
});

const VALIDATOR_ACCOUNT = privateKeyToAccount(env.PRIVATE_KEY as Address);
export const config = {
  ...env,
  OUTPUT_DIR: join(process.cwd(), "data", "output"),
  VALIDATOR_ADDRESS: VALIDATOR_ACCOUNT.address,
  VALIDATOR_DID: `did:val:${VALIDATOR_ACCOUNT.address}`,
  VALIDATOR_ACCOUNT,
};

mkdirSync(config.OUTPUT_DIR, { recursive: true });
