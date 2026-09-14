import { getYouTubeAuthorizationRuntime } from "../../../../../server/youtube";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export function GET(request: Request): Promise<Response> { return getYouTubeAuthorizationRuntime().handlers.connect(request, "analytics-scope-upgrade"); }
