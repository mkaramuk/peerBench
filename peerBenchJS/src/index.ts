import { red } from "ansis";
import { logger } from "./core/logger";
import { program } from "./core/program";

import "@/commands/prompt";
import "@/commands/score";
import "@/commands/aggregate";
import "@/commands/upload";
import "@/commands/rephrase";
import "@/commands/std";
import { ensureError } from "./core/utils";

program.parseAsync().catch((err) => {
  const error = ensureError(err);
  logger.error(red(error.stack));
});
