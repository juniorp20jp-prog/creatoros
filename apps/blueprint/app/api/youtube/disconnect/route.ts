import { getYouTubeAuthorizationRuntime } from "../../../../server/youtube";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function POST(request: Request): Promise<Response> { return getYouTubeAuthorizationRuntime().handlers.disconnect(request); }
