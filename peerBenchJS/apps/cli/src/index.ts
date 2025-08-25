import { red } from "ansis";
import { logger } from "./core/logger";
import { program } from "./core/program";
import { ensureError, readFile } from "./core/utils";
import { NearAIProvider, OpenRouterProvider } from "@peerbench/sdk";
import { homedir } from "os";
import { join } from "path";
import { addProvider } from "./core/providers";

import "@/commands/prompt";
import "@/commands/score";
import "@/commands/aggregate";
import "@/commands/upload";
import "@/commands/rephrase";
import "@/commands/std";

async function main() {
  // Initialize the providers
  await addProvider(
    () =>
      new OpenRouterProvider({
        apiKey: process.env.PB_OPENROUTER_AI_KEY || "",
      })
  );
  await addProvider(async () => {
    const defaultPath = join(homedir(), ".nearai", "config.json");
    const content = await readFile(
      process.env.PB_NEARAI_CONFIG_PATH || defaultPath
    );
    const config = JSON.parse(content.toString());

    if (!config?.auth?.signature) {
      throw new Error(
        'Signature is not found. Please try to login via "nearai" CLI'
      );
    }

    return new NearAIProvider({
      apiKey: JSON.stringify(config?.auth),
    });
  });

  // Parse the CLI arguments
  program.parseAsync().catch((err) => {
    const error = ensureError(err);
    logger.error(red(error.stack));
  });
}

main();
