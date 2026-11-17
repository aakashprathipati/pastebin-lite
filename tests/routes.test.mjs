import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

let createdInput;
let consumedArgs;
let paste = null;
let redisAvailable = true;
globalThis.__routeMocks = {
  createPaste: async (input, nowMs) => { createdInput = [input, nowMs]; return { id: "test-id" }; },
  getCurrentTimeMs: () => 1234,
  getAndConsumePaste: async (...args) => { consumedArgs = args; return paste; },
  getRedis: () => ({ ping: async () => { if (!redisAvailable) throw new Error("secret connection detail"); return "PONG"; } }),
  jsonResponse: (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } }),
};
async function load(path) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8")
    .replace(/import \{([^}]+)\} from "@\/lib\/[^";]+";/g, "const {$1} = globalThis.__routeMocks;");
  return import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`);
}
const { POST } = await load("../src/app/api/pastes/route.ts");
const { GET } = await load("../src/app/api/pastes/[id]/route.ts");
const health = await load("../src/app/api/healthz/route.ts");
const request = (body) => new Request("https://paste.example/api/pastes", { method: "POST", body: JSON.stringify(body) });

test("POST rejects malformed JSON and invalid inputs with JSON errors", async () => {
  const invalidJson = new Request("https://paste.example/api/pastes", { method: "POST", body: "{" });
  assert.equal((await POST(invalidJson)).status, 400);
  for (const body of [null, [], {}, { content: " " }, { content: 123 },
    { content: "x", ttl_seconds: 0 }, { content: "x", ttl_seconds: "1" },
    { content: "x", max_views: null }, { content: "x", max_views: 1.5 }]) {
    const response = await POST(request(body));
    assert.equal(response.status, 400);
    assert.equal(typeof (await response.json()).error, "string");
  }
});

test("POST creates a deployment-relative absolute URL and passes the request clock", async () => {
  const body = { content: "<script>alert(1)</script>", ttl_seconds: 1, max_views: 2 };
  const response = await POST(request(body));
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { id: "test-id", url: "https://paste.example/p/test-id" });
  assert.deepEqual(createdInput, [body, 1234]);
});

test("GET consumes a view and returns only the public response fields", async () => {
  paste = { content: "hello", remaining_views: 0, expires_at: null, view_count: 1 };
  const response = await GET(new Request("https://paste.example/api/pastes/test-id"), { params: Promise.resolve({ id: "test-id" }) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), { content: "hello", remaining_views: 0, expires_at: null });
  assert.deepEqual(consumedArgs, ["test-id", 1234, true]);
  paste = null;
  assert.equal((await GET(new Request("https://paste.example/api/pastes/test-id"), { params: Promise.resolve({ id: "test-id" }) })).status, 404);
});

test("health checks Redis and hides connection errors", async () => {
  assert.deepEqual(await (await health.GET()).json(), { ok: true });
  redisAvailable = false;
  const response = await health.GET();
  assert.equal(response.status, 503);
  assert.equal((await response.json()).ok, false);
  redisAvailable = true;
});
