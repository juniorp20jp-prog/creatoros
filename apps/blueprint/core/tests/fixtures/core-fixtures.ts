import type { AiProvider } from "../../interfaces/ai-provider";
import type { IntelligenceEngine } from "../../interfaces/intelligence-engine";
import { EngineRegistry } from "../../engines/engine-registry";
import {
  completeExecution,
  DefaultExecutionContextFactory,
  EngineRuntime,
  failExecution,
  type Clock,
  type IdGenerator,
} from "../../services";
import type {
  EngineDefinition,
  EngineExecutionContext,
  EngineExecutionResult,
} from "../../types";
import type { CreatorIntelligenceInput } from "../../engines/creator-intelligence";

export const TEST_ENGINE_ID = "test-engine" as const;

export type TestEngineInput = {
  value: number;
  shouldFail?: boolean;
};

export type TestEngineOutput = {
  value: number;
  context: {
    executionId: string;
    engineId: string;
    startedAt: string;
    locale?: string;
    correlationId?: string;
    attributes: Readonly<Record<string, string>>;
  };
};

export type TestEngineContracts = {
  [TEST_ENGINE_ID]: {
    input: TestEngineInput;
    output: TestEngineOutput;
  };
};

const testEngineDefinition = {
  id: TEST_ENGINE_ID,
  name: "Test Engine",
  version: "1.0.0",
  capabilities: ["testing"],
} satisfies EngineDefinition<typeof TEST_ENGINE_ID>;

export class TestEngine
  implements
    IntelligenceEngine<
      typeof TEST_ENGINE_ID,
      TestEngineInput,
      TestEngineOutput
    >
{
  readonly definition = testEngineDefinition;

  execute(
    input: TestEngineInput,
    context: EngineExecutionContext,
  ): Promise<EngineExecutionResult<TestEngineOutput>> {
    if (input.shouldFail) {
      return Promise.resolve(
        failExecution(context, {
          code: "TEST_ENGINE_FAILURE",
          message: "The test engine was asked to fail.",
          retryable: false,
        }),
      );
    }

    return Promise.resolve(
      completeExecution(
        context,
        {
          value: input.value * 2,
          context: {
            executionId: context.executionId,
            engineId: context.engineId,
            startedAt: context.startedAt,
            locale: context.locale,
            correlationId: context.correlationId,
            attributes: context.attributes,
          },
        },
        {
          providerIds: ["test-provider"],
          completedStepIds: ["test-step"],
        },
      ),
    );
  }
}

export class SequenceClock implements Clock {
  private index = 0;

  constructor(private readonly values: ReadonlyArray<string>) {
    if (values.length === 0) {
      throw new Error("SequenceClock requires at least one timestamp.");
    }
  }

  now(): string {
    const fallback = this.values[this.values.length - 1];
    const value = this.values[this.index] ?? fallback;
    this.index += 1;

    if (!value) {
      throw new Error("SequenceClock has no timestamp available.");
    }

    return value;
  }
}

export class FixedIdGenerator implements IdGenerator {
  constructor(private readonly value = "fixed") {}

  create(prefix: string): string {
    return `${prefix}_${this.value}`;
  }
}

export function createTestRuntime(options?: {
  clock?: Clock;
  idGenerator?: IdGenerator;
}) {
  const engine = new TestEngine();
  const registry = new EngineRegistry<TestEngineContracts>();
  const contextFactory = new DefaultExecutionContextFactory(
    options?.clock,
    options?.idGenerator,
  );

  registry.register(engine);

  return {
    engine,
    registry,
    runtime: new EngineRuntime(registry, contextFactory),
  };
}

export type TestProviderRequest = {
  prompt: string;
};

export type TestProviderResponse = {
  outputCode: string;
};

export class TestProvider
  implements AiProvider<TestProviderRequest, TestProviderResponse>
{
  readonly definition = {
    id: "test-provider",
    name: "Test Provider",
    modelFamily: "deterministic",
    capabilities: ["testing"],
  };

  constructor(private readonly apiKey = "test-secret-never-expose") {}

  isAvailable(): Promise<boolean> {
    return Promise.resolve(this.apiKey.length > 0);
  }

  execute(
    request: TestProviderRequest,
  ): Promise<TestProviderResponse> {
    return Promise.resolve({
      outputCode: `processed:${request.prompt}`,
    });
  }
}

export const creatorInputWithoutSources: CreatorIntelligenceInput = {
  creator: {
    creatorId: "creator_test",
    displayName: "Test Creator",
    locale: "es",
    channels: [],
  },
  objective: {
    id: "objective_test",
    kind: "audience-growth",
    target: 1000,
    targetDate: "2027-01-01",
  },
  sources: [],
};

export const creatorInputWithSources: CreatorIntelligenceInput = {
  ...creatorInputWithoutSources,
  sources: [
    {
      sourceId: "source_test",
      providerId: "provider_test",
      kind: "channel-data",
      collectedAt: "2026-07-20T12:00:00.000Z",
      payload: {
        channelId: "channel_test",
      },
    },
  ],
};
