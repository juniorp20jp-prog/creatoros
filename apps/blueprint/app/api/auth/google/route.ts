import { getInternalAnalysisApiRuntime } from "../../../../server/analysis-api/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request): Promise<Response> {
  return getInternalAnalysisApiRuntime().auth.login(request);
}
