import { getYouTubeAuthorizationRuntime } from "../../../../../../../server/youtube";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export function GET(request: Request, context: { params: Promise<{ videoId: string }> }): Promise<Response> { return context.params.then(({ videoId }) => getYouTubeAuthorizationRuntime().historicalHandlers.videoHistory(request, videoId)); }
