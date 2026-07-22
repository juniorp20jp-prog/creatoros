import assert from "node:assert/strict";
import { test } from "node:test";

import { AiPipeline, type PipelineStep } from "../pipeline";
import { DefaultExecutionContextFactory } from "../services";
import {
  FixedIdGenerator,
  SequenceClock,
} from "./fixtures/core-fixtures";

type PipelineState = {
  value: number;
  trace: ReadonlyArray<string>;
};

function createContext() {
  return new DefaultExecutionContextFactory(
    new SequenceClock(["2026-07-20T12:00:00.000Z"]),
    new FixedIdGenerator(),
  ).create({ engineId: "pipeline-test" });
}

function createStep(
  id: string,
  transform: (state: Readonly<PipelineState>) => PipelineState,
): PipelineStep<PipelineState> {
  return {
    id,
    execute: (state) => Promise.resolve(transform(state)),
  };
}

test("AiPipeline executes steps in registration order", async () => {
  const pipeline = new AiPipeline<PipelineState>([
    createStep("first", (state) => ({
      value: state.value + 1,
      trace: [...state.trace, "first"],
    })),
    createStep("second", (state) => ({
      value: state.value * 2,
      trace: [...state.trace, "second"],
    })),
  ]);

  const result = await pipeline.run({ value: 1, trace: [] }, createContext());

  assert.deepEqual(result.state.trace, ["first", "second"]);
});

test("AiPipeline transports state between steps", async () => {
  const pipeline = new AiPipeline<PipelineState>([
    createStep("increment", (state) => ({ ...state, value: state.value + 2 })),
    createStep("multiply", (state) => ({ ...state, value: state.value * 3 })),
  ]);

  const result = await pipeline.run({ value: 2, trace: [] }, createContext());

  assert.equal(result.state.value, 12);
});

test("AiPipeline records completed step metadata", async () => {
  const pipeline = new AiPipeline<PipelineState>([
    createStep("collect", (state) => state),
    createStep("reason", (state) => state),
  ]);

  const result = await pipeline.run({ value: 0, trace: [] }, createContext());

  assert.deepEqual(result.completedStepIds, ["collect", "reason"]);
});

test("AiPipeline surfaces a step failure", async () => {
  const failingStep: PipelineStep<PipelineState> = {
    id: "failing-step",
    execute: () => Promise.reject(new Error("pipeline failure")),
  };
  const pipeline = new AiPipeline([failingStep]);

  await assert.rejects(
    pipeline.run({ value: 0, trace: [] }, createContext()),
    /pipeline failure/,
  );
});

test("AiPipeline does not execute steps after a failure", async () => {
  let laterStepExecuted = false;
  const pipeline = new AiPipeline<PipelineState>([
    {
      id: "stop",
      execute: () => Promise.reject(new Error("stop pipeline")),
    },
    {
      id: "must-not-run",
      execute: (state) => {
        laterStepExecuted = true;
        return Promise.resolve(state);
      },
    },
  ]);

  await assert.rejects(
    pipeline.run({ value: 0, trace: [] }, createContext()),
    /stop pipeline/,
  );
  assert.equal(laterStepExecuted, false);
});
