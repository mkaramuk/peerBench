import { AbstractProvider } from "@/base/provider";
import { logger } from "./logger";
import { OpenRouterProvider } from "@/providers/openrouter";

function addProvider(instantiate: () => AbstractProvider) {
  try {
    providers.push(instantiate());
  } catch (err: any) {
    logger.warning(`Couldn't add provider: ${err?.message}`);
  }
}

export const providers: AbstractProvider[] = [];

addProvider(() => new OpenRouterProvider());
