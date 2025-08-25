import { BaseLLMProvider, MaybePromise } from "@peerbench/sdk";
import { logger } from "./logger";

export async function addProvider(
  instantiate: () => MaybePromise<BaseLLMProvider>
) {
  try {
    providers.push(await instantiate());
  } catch (err: any) {
    logger.warning(`Couldn't add provider: ${err?.message}`);
  }
}

export const providers: BaseLLMProvider[] = [];

export function getProvider(name: string) {
  const provider = providers.find((p) => p.name === name);
  if (provider === undefined) {
    logger.warning(`Provider not found: ${name}`);
    return;
  }

  return provider;
}
