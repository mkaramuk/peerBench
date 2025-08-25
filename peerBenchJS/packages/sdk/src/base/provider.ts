import { ModelResponse } from "@/types";

/**
 * Base abstract class that all providers must implement
 */
export abstract class AbstractProvider {
  /**
   * Name of the provider
   */
  readonly name: string;

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
  }

  /**
   * Executes the given prompt and returns the response
   * @param prompt
   * @param model
   * @param params Additional parameters for the request
   */
  abstract forward(
    prompt: string,
    model: string,
    params?: any
  ): Promise<ModelResponse>;
}
