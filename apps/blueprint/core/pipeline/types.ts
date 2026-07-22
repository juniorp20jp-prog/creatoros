import type { EngineExecutionContext } from "../types/engine";

export interface PipelineStep<TState> {
  readonly id: string;

  execute(
    state: Readonly<TState>,
    context: EngineExecutionContext,
  ): Promise<TState>;
}

export type PipelineRunResult<TState> = {
  state: TState;
  completedStepIds: ReadonlyArray<string>;
};
