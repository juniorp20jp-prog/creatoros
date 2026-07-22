import type {
  EngineDefinition,
  EngineExecutionContext,
  EngineExecutionResult,
} from "../types/engine";

export interface IntelligenceEngine<
  TId extends string,
  TInput,
  TOutput,
> {
  readonly definition: EngineDefinition<TId>;

  execute(
    input: TInput,
    context: EngineExecutionContext,
  ): Promise<EngineExecutionResult<TOutput>>;
}
