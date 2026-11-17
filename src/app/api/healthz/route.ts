import { getRedis } from "@/lib/redis";
import { jsonResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      getRedis().ping(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Redis health check timed out.")), 3000);
      }),
    ]);
    return jsonResponse({ ok: true });
  } catch {
    return jsonResponse({ ok: false, error: "Redis is unavailable." }, 503);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}
