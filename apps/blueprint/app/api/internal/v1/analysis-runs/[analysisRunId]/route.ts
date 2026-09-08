import { getInternalAnalysisApiRuntime } from "../../../../../../server/analysis-api/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AnalysisRunRouteContext = {
  params: Promise<{ analysisRunId: string }>;
};

export async function GET(
  request: Request,
  context: AnalysisRunRouteContext,
): Promise<Response> {
  const { analysisRunId } = await context.params;
  const runtime = getInternalAnalysisApiRuntime();
  return runtime.auth.protect(request, (principal) => runtime.api.getAnalysis(analysisRunId, principal));
}

export async function DELETE(
  request: Request,
  context: AnalysisRunRouteContext,
): Promise<Response> {
  const { analysisRunId } = await context.params;
  const runtime = getInternalAnalysisApiRuntime();
  return runtime.auth.protect(request, (principal) => runtime.api.deleteAnalysis(request, analysisRunId, principal));
}
