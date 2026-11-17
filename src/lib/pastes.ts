import "server-only";
import { nanoid } from "nanoid";
import { getRedis } from "./redis";
import type { CreatePasteInput, Paste, StoredPaste } from "../types/paste";

const MAX_DATE_MS = 8_640_000_000_000_000;
const keyFor = (id: string): string => `paste:${id}`;

// SET NX prevents even an ID collision from overwriting an existing paste.
const CREATE_SCRIPT = `
  local result = redis.call("SET", KEYS[1], ARGV[1], "NX")
  if result then return 1 end
  return 0
`;

// Everything affecting availability happens within this one atomic operation.
// JSON preserves explicit null values; Lua array replies would truncate at nil.
const CONSUME_SCRIPT = `
  local raw = redis.call("GET", KEYS[1])
  if not raw then return nil end

  local paste = cjson.decode(raw)
  local now = tonumber(ARGV[1])
  if paste.expires_at_ms ~= cjson.null and now >= paste.expires_at_ms then
    return nil
  end
  if paste.max_views ~= cjson.null and paste.view_count >= paste.max_views then
    return nil
  end

  if ARGV[2] == "1" then
    paste.view_count = paste.view_count + 1
    redis.call("SET", KEYS[1], cjson.encode(paste))
  end

  return cjson.encode(paste)
`;

function isTimestamp(value: number): boolean {
  return Number.isSafeInteger(value) && Math.abs(value) <= MAX_DATE_MS;
}

/** The test clock is used only for expiration, never creation audit timestamps. */
export function getCurrentTimeMs(request?: Request): number {
  if (process.env.TEST_MODE === "1" && request) {
    const header = request.headers.get("x-test-now-ms");
    if (header !== null && header.trim() !== "") {
      const value = Number(header);
      if (isTimestamp(value)) return value;
    }
  }
  return Date.now();
}

function toPaste(stored: StoredPaste): Paste {
  return {
    ...stored,
    remaining_views:
      stored.max_views === null
        ? null
        : Math.max(0, stored.max_views - stored.view_count),
    expires_at:
      stored.expires_at_ms === null
        ? null
        : new Date(stored.expires_at_ms).toISOString(),
  };
}

/** Pass getCurrentTimeMs(request) as nowMs when creating from a request. */
export async function createPaste(
  input: CreatePasteInput,
  nowMs: number = getCurrentTimeMs(),
): Promise<Paste> {
  if (typeof input.content !== "string" || input.content.trim().length === 0) {
    throw new TypeError("content must be a non-empty string.");
  }
  for (const field of ["ttl_seconds", "max_views"] as const) {
    const value = input[field];
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 1)) {
      throw new TypeError(`${field} must be a positive safe integer.`);
    }
  }
  if (!isTimestamp(nowMs)) throw new TypeError("nowMs must be a valid integer timestamp.");

  const expiresAtMs = input.ttl_seconds === undefined
    ? null
    : nowMs + input.ttl_seconds * 1_000;
  if (expiresAtMs !== null && !isTimestamp(expiresAtMs)) {
    throw new RangeError("ttl_seconds produces an invalid expiration timestamp.");
  }

  const createdAtMs = Date.now();
  for (let attempt = 0; attempt < 5; attempt++) {
    const stored: StoredPaste = {
      id: nanoid(),
      content: input.content,
      created_at_ms: createdAtMs,
      expires_at_ms: expiresAtMs,
      max_views: input.max_views ?? null,
      view_count: 0,
    };
    const inserted = await getRedis().eval<[string], number>(
      CREATE_SCRIPT, [keyFor(stored.id)], [JSON.stringify(stored)],
    );
    if (inserted === 1) return toPaste(stored);
  }
  throw new Error("Could not allocate a unique paste ID.");
}

/** null means missing, expired, or exhausted. Only countView=true consumes a view. */
export async function getAndConsumePaste(
  id: string,
  nowMs: number,
  countView: boolean,
): Promise<Paste | null> {
  if (!isTimestamp(nowMs)) throw new TypeError("nowMs must be a valid integer timestamp.");
  if (typeof countView !== "boolean") throw new TypeError("countView must be a boolean.");
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{21}$/.test(id)) return null;

  const result = await getRedis().eval<[number, string], StoredPaste | string | null>(
    CONSUME_SCRIPT, [keyFor(id)], [nowMs, countView ? "1" : "0"],
  );
  if (result === null) return null;
  // Upstash normally deserializes JSON replies; also support raw JSON strings.
  const stored: StoredPaste = typeof result === "string" ? JSON.parse(result) : result;
  return toPaste(stored);
}
