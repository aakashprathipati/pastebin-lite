import { getAndConsumePaste, getCurrentTimeMs } from "@/lib/pastes";
import { jsonResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await context.params;
    const paste = await getAndConsumePaste(id, getCurrentTimeMs(request), true);
    if (!paste) return jsonResponse({ error: "Paste not found or no longer available." }, 404);
    return jsonResponse({
      content: paste.content,
      remaining_views: paste.remaining_views,
      expires_at: paste.expires_at,
    });
  } catch {
    return jsonResponse({ error: "Unable to retrieve paste. Please try again." }, 503);
  }
}
