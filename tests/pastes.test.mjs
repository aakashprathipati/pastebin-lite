import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

// Exercise the TypeScript wrapper without installing the Next.js scaffold.
// This mock does not execute Lua; concurrency needs a live Redis integration test.
let reply;
let calls = [];
globalThis.__pasteTestRedis = {
  eval: async (...args) => {
    calls.push(args);
    return typeof reply === "function" ? reply(...args) : reply;
  },
};
let source = readFileSync(new URL("../src/lib/pastes.ts", import.meta.url), "utf8");
source = source
  .replace('import "server-only";', "")
  .replace('import { nanoid } from "nanoid";', 'const nanoid = () => "a".repeat(21);')
  .replace('import { getRedis } from "./redis";', "const getRedis = () => globalThis.__pasteTestRedis;");
const compiled = stripTypeScriptTypes(source);
const { createPaste, getAndConsumePaste, getCurrentTimeMs } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

test("test clock requires exactly TEST_MODE=1 and a valid timestamp", () => {
  const previous = process.env.TEST_MODE;
  const originalNow = Date.now;
  Date.now = () => 1000;
  try {
    const request = (value) => new Request("https://example.test", {
      headers: { "x-test-now-ms": value },
    });
    process.env.TEST_MODE = "true";
    assert.equal(getCurrentTimeMs(request("2000")), 1000);
    process.env.TEST_MODE = "1";
    assert.equal(getCurrentTimeMs(request("2000")), 2000);
    assert.equal(getCurrentTimeMs(request("0")), 0);
    for (const value of ["", " ", "NaN", "Infinity", "1.5", "9007199254740992"]) {
      assert.equal(getCurrentTimeMs(request(value)), 1000);
    }
    assert.equal(getCurrentTimeMs(), 1000);
  } finally {
    Date.now = originalNow;
    if (previous === undefined) delete process.env.TEST_MODE;
    else process.env.TEST_MODE = previous;
  }
});

test("creation returns metadata, preserves content, and uses real creation time", async () => {
  reply = 1;
  const before = Date.now();
  const paste = await createPaste({ content: "  hello  ", ttl_seconds: 2, max_views: 2 }, 1000);
  assert.equal(paste.content, "  hello  ");
  assert.ok(paste.created_at_ms >= before);
  assert.equal(paste.expires_at_ms, 3000);
  assert.equal(paste.expires_at, "1970-01-01T00:00:03.000Z");
  assert.equal(paste.remaining_views, 2);
  assert.equal(paste.view_count, 0);
  const unlimited = await createPaste({ content: "hello" });
  assert.equal(unlimited.remaining_views, null);
  assert.equal(unlimited.expires_at, null);
});

test("creation validates input and bounds collision retries", async () => {
  for (const input of [{ content: " " }, { content: "x", ttl_seconds: 0 },
    { content: "x", max_views: -1 }, { content: "x", max_views: 1.5 }]) {
    await assert.rejects(createPaste(input), TypeError);
  }
  await assert.rejects(createPaste({ content: "x", ttl_seconds: Number.MAX_SAFE_INTEGER }), RangeError);
  calls = [];
  reply = 0;
  await assert.rejects(createPaste({ content: "hello" }), /unique paste ID/);
  assert.equal(calls.length, 5);
});

test("retrieval passes time and consumption flag and formats both SDK reply forms", async () => {
  const stored = { id: "a".repeat(21), content: "x", created_at_ms: 0,
    expires_at_ms: null, max_views: 1, view_count: 1 };
  for (const value of [stored, JSON.stringify(stored)]) {
    reply = value;
    assert.equal((await getAndConsumePaste(stored.id, 2000, true)).remaining_views, 0);
    assert.deepEqual(calls.at(-1).slice(1), [[`paste:${stored.id}`], [2000, "1"]]);
  }
  reply = null;
  assert.equal(await getAndConsumePaste(stored.id, 2000, false), null);
  assert.deepEqual(calls.at(-1)[2], [2000, "0"]);
  assert.equal(await getAndConsumePaste("invalid", 2000, true), null);
});
