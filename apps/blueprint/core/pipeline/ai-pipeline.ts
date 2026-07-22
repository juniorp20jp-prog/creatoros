import type { EngineExecutionContext } from "../types/engine";
import type {
  PipelineRunResult,
  PipelineStep,
} from "./types";

export class AiPipeline<TState> {
  constructor(
    private readonly steps: ReadonlyArray<PipelineStep<TState>>,
  ) {}

  async run(
    initialState: TState,
    context: EngineExecutionContext,
  ): Promise<PipelineRunResult<TState>> {
    let state = initialState;
    const completedStepIds: string[] = [];

    for (const step of this.steps) {
      state = await step.execute(state, context);
      completedStepIds.push(step.id);
    }

    return {
      state,
      completedStepIds,
    };
  }
}
