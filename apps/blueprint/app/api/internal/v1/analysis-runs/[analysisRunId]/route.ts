import { getInternalAnalysisApiRuntime } from "../../../../../../server/analysis-api/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AnalysisRunRouteContext = {
  params: Promise<{ analysisRunId: string }>;
};

export async function GET(
  _request: Request,
  context: AnalysisRunRouteContext,
): Promise<Response> {
  const { analysisRunId } = await context.params;
  return getInternalAnalysisApiRuntime().api.getAnalysis(analysisRunId);
}

export async function DELETE(
  request: Request,
  context: AnalysisRunRouteContext,
): Promise<Response> {
  const { analysisRunId } = await context.params;
  return getInternalAnalysisApiRuntime().api.deleteAnalysis(
    request,
    analysisRunId,
  );
}
