import { AbstractProvider } from "@/base/provider";
import { logger } from "./logger";
import { OpenRouterProvider } from "@/providers/openrouter";
import { NearAIProvider } from "@/providers/nearai";

function addProvider(instantiate: () => AbstractProvider) {
  try {
    providers.push(instantiate());
  } catch (err: any) {
    logger.warning(`Couldn't add provider: ${err?.message}`);
  }
}

export const providers: AbstractProvider[] = [];

addProvider(() => new OpenRouterProvider());
addProvider(() => new NearAIProvider());

export function getProvider(name: string) {
  const provider = providers.find((p) => p.name === name);
  if (provider === undefined) {
    logger.warning(`Provider not found: ${name}`);
    return;
  }

  return provider;
}
