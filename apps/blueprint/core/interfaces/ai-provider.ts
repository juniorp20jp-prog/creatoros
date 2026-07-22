import type { EngineExecutionContext } from "../types/engine";

export type AiProviderDefinition = {
  id: string;
  name: string;
  modelFamily: string;
  capabilities: ReadonlyArray<string>;
};

export interface AiProvider<TRequest, TResponse> {
  readonly definition: AiProviderDefinition;

  isAvailable(): Promise<boolean>;

  execute(
    request: TRequest,
    context: EngineExecutionContext,
  ): Promise<TResponse>;
}
