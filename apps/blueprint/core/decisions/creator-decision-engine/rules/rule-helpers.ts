import type {
  CreatorDecisionInput,
  CreatorSignal,
  DecisionEvidence,
  DecisionMessage,
} from "../domain";

export function message(
  messageKey: string,
  defaultMessage: string,
  parameters: Readonly<Record<string, string | number>> = {},
): DecisionMessage {
  return { messageKey, defaultMessage, parameters };
}

export function signalByDimension(
  input: CreatorDecisionInput,
  dimension: CreatorSignal["dimension"],
  direction?: CreatorSignal["direction"],
): CreatorSignal | null {
  const signals = input.signals
    .filter(
      (signal) =>
        signal.dimension === dimension &&
        (direction === undefined || signal.direction === direction),
    )
    .sort(
      (left, right) =>
        right.magnitude - left.magnitude || left.id.localeCompare(right.id),
    );
  return signals[0] ?? null;
}

export function numericEvidence(
  evidence: ReadonlyArray<DecisionEvidence>,
  sourceSuffix: string,
): number | null {
  const match = evidence.find((item) => item.sourceRef.endsWith(sourceSuffix));
  return match !== undefined && typeof match.value === "number"
    ? match.value
    : null;
}

export function uniqueEvidence(
  signals: ReadonlyArray<CreatorSignal>,
): ReadonlyArray<DecisionEvidence> {
  const byId = new Map<string, DecisionEvidence>();
  for (const signal of signals) {
    for (const evidence of signal.evidence) {
      byId.set(evidence.id, evidence);
    }
  }
  return [...byId.values()].sort((left, right) => left.id.localeCompare(right.id));
}

export function relatedEntityOverlap(
  left: CreatorSignal,
  right: CreatorSignal,
): ReadonlyArray<string> {
  const rightIds = new Set(right.relatedEntityIds);
  return left.relatedEntityIds.filter((id) => rightIds.has(id)).sort();
}

