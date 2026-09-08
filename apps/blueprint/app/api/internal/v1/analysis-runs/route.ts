import { getInternalAnalysisApiRuntime } from "../../../../../server/analysis-api/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request): Promise<Response> {
  const runtime = getInternalAnalysisApiRuntime();
  return runtime.auth.protect(request, (principal) => runtime.api.listAnalysisRuns(request, principal));
}

export function POST(request: Request): Promise<Response> {
  const runtime = getInternalAnalysisApiRuntime();
  return runtime.auth.protect(request, (principal) => runtime.api.runAnalysis(request, principal));
}
