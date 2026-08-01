import { getInternalAnalysisApiRuntime } from "../../../../../../../server/analysis-api/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AnalysisHistoryRouteContext = {
  params: Promise<{ analysisRunId: string }>;
};

export async function GET(
  request: Request,
  context: AnalysisHistoryRouteContext,
): Promise<Response> {
  const { analysisRunId } = await context.params;
  const runtime = getInternalAnalysisApiRuntime();
  return runtime.auth.protect(request, () => runtime.api.getAnalysisHistory(analysisRunId));
}
