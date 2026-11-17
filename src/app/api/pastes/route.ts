import { createPaste, getCurrentTimeMs } from "@/lib/pastes";
import { jsonResponse } from "@/lib/http";
import type { CreatePasteInput } from "@/types/paste";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse({ error: "Request body must be a JSON object." }, 400);
  }
  const input = body as Record<string, unknown>;
  if (typeof input.content !== "string" || !input.content.trim()) {
    return jsonResponse({ error: "content must be a non-empty string." }, 400);
  }
  for (const field of ["ttl_seconds", "max_views"] as const) {
    const value = input[field];
    if (value !== undefined && (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1)) {
      return jsonResponse({ error: `${field} must be a positive safe integer.` }, 400);
    }
  }
  try {
    const paste = await createPaste(input as unknown as CreatePasteInput, getCurrentTimeMs(request));
    return jsonResponse({
      id: paste.id,
      url: new URL(`/p/${paste.id}`, request.url).href,
    }, 201);
  } catch (error) {
    if (error instanceof TypeError || error instanceof RangeError) {
      return jsonResponse({ error: error.message }, 400);
    }
    return jsonResponse({ error: "Unable to create paste. Please try again." }, 503);
  }
}
