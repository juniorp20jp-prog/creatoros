import type { IntelligenceEngine } from "../interfaces/intelligence-engine";
import type {
  EngineContractsConstraint,
  EngineDefinition,
} from "../types/engine";

type ContractInput<TContract> = TContract extends { input: infer TInput }
  ? TInput
  : never;

type ContractOutput<TContract> = TContract extends { output: infer TOutput }
  ? TOutput
  : never;

export class EngineRegistry<
  TContracts extends EngineContractsConstraint<TContracts>,
> {
  private readonly engines = new Map<keyof TContracts & string, unknown>();
  private readonly definitions = new Map<
    keyof TContracts & string,
    EngineDefinition<keyof TContracts & string>
  >();

  register<TKey extends keyof TContracts & string>(
    engine: IntelligenceEngine<
      TKey,
      ContractInput<TContracts[TKey]>,
      ContractOutput<TContracts[TKey]>
    >,
  ): void {
    const { id } = engine.definition;

    if (this.engines.has(id)) {
      throw new Error(`Intelligence engine "${id}" is already registered.`);
    }

    this.engines.set(id, engine);
    this.definitions.set(id, engine.definition);
  }

  resolve<TKey extends keyof TContracts & string>(
    engineId: TKey,
  ): IntelligenceEngine<
    TKey,
    ContractInput<TContracts[TKey]>,
    ContractOutput<TContracts[TKey]>
  > {
    const engine = this.engines.get(engineId);

    if (!engine) {
      throw new Error(
        `Intelligence engine "${engineId}" is not registered.`,
      );
    }

    return engine as IntelligenceEngine<
      TKey,
      ContractInput<TContracts[TKey]>,
      ContractOutput<TContracts[TKey]>
    >;
  }

  has(engineId: keyof TContracts & string): boolean {
    return this.engines.has(engineId);
  }

  list(): ReadonlyArray<EngineDefinition<keyof TContracts & string>> {
    return Array.from(this.definitions.values());
  }
}
