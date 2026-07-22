import type { EngineRegistry } from "../engines/engine-registry";
import type {
  EngineContractsConstraint,
  EngineExecutionResult,
} from "../types/engine";
import {
  DefaultExecutionContextFactory,
  type ExecutionContextFactory,
  type ExecutionContextOptions,
} from "./execution-context";

type ContractInput<TContract> = TContract extends { input: infer TInput }
  ? TInput
  : never;

type ContractOutput<TContract> = TContract extends { output: infer TOutput }
  ? TOutput
  : never;

export type EngineRuntimeOptions = Omit<ExecutionContextOptions, "engineId">;

export class EngineRuntime<
  TContracts extends EngineContractsConstraint<TContracts>,
> {
  constructor(
    private readonly registry: EngineRegistry<TContracts>,
    private readonly contextFactory: ExecutionContextFactory =
      new DefaultExecutionContextFactory(),
  ) {}

  execute<TKey extends keyof TContracts & string>(
    engineId: TKey,
    input: ContractInput<TContracts[TKey]>,
    options: EngineRuntimeOptions = {},
  ): Promise<EngineExecutionResult<ContractOutput<TContracts[TKey]>>> {
    const engine = this.registry.resolve(engineId);
    const context = this.contextFactory.create({
      engineId,
      ...options,
    });

    return engine.execute(input, context);
  }

  listEngines() {
    return this.registry.list();
  }
}
