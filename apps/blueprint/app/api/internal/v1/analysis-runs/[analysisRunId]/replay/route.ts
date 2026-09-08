import { getInternalAnalysisApiRuntime } from "../../../../../../../server/analysis-api/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AnalysisReplayRouteContext = {
  params: Promise<{ analysisRunId: string }>;
};

export async function POST(
  request: Request,
  context: AnalysisReplayRouteContext,
): Promise<Response> {
  const { analysisRunId } = await context.params;
  const runtime = getInternalAnalysisApiRuntime();
  return runtime.auth.protect(request, (principal) => runtime.api.replayAnalysis(request, analysisRunId, principal));
}
