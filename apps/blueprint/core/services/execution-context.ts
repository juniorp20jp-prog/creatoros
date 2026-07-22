import type { EngineExecutionContext } from "../types/engine";

export interface Clock {
  now(): string;
}

export interface IdGenerator {
  create(prefix: string): string;
}

export type ExecutionContextOptions = {
  engineId: string;
  locale?: string;
  correlationId?: string;
  attributes?: Readonly<Record<string, string>>;
};

export interface ExecutionContextFactory {
  create(options: ExecutionContextOptions): EngineExecutionContext;
}

export class SystemClock implements Clock {
  now(): string {
    return new Date().toISOString();
  }
}

export class UuidGenerator implements IdGenerator {
  create(prefix: string): string {
    return `${prefix}_${crypto.randomUUID()}`;
  }
}

export class DefaultExecutionContextFactory
  implements ExecutionContextFactory
{
  constructor(
    private readonly clock: Clock = new SystemClock(),
    private readonly idGenerator: IdGenerator = new UuidGenerator(),
  ) {}

  create(options: ExecutionContextOptions): EngineExecutionContext {
    return {
      executionId: this.idGenerator.create("exec"),
      engineId: options.engineId,
      startedAt: this.clock.now(),
      locale: options.locale,
      correlationId: options.correlationId,
      attributes: options.attributes ?? {},
      now: () => this.clock.now(),
    };
  }
}
