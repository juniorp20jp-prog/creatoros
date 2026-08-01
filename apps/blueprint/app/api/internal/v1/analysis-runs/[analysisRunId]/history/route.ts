import { getInternalAnalysisApiRuntime } from "../../../../../../../server/analysis-api/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AnalysisHistoryRouteContext = {
  params: Promise<{ analysisRunId: string }>;
};

export async function GET(
  _request: Request,
  context: AnalysisHistoryRouteContext,
): Promise<Response> {
  const { analysisRunId } = await context.params;
  return getInternalAnalysisApiRuntime().api.getAnalysisHistory(
    analysisRunId,
  );
}
