import { test } from "node:test";
import assert from "node:assert/strict";
import { splitUtf8, isLanguage } from "../lib/translation";
import { POST } from "../app/api/translate/route";
const request = (body: unknown) =>
  new Request("http://localhost/api/translate", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
test("UTF-8 chunks roundtrip Japanese, Khmer and emoji within upstream byte limit", () => {
  const text = "日本語ភាសាខ្មែរ👨‍👩‍👧‍👦 Xin chào!".repeat(40);
  const chunks = splitUtf8(text);
  assert.equal(chunks.join(""), text);
  assert.ok(chunks.every((c) => new TextEncoder().encode(c).length <= 480));
  assert.equal(isLanguage("__proto__"), false);
});
test("reject invalid request types, prototype names, excessive input and cross origin", async () => {
  for (const body of [
    null,
    [],
    { text: "" },
    { text: "a".repeat(601), source: "ja", target: "vi" },
    { text: "こんにちは", source: "__proto__", target: "vi" },
    { text: "a", source: "ja", target: "vi", tone: "constructor" },
  ])
    assert.equal((await POST(request(body))).status, 400);
  assert.equal(
    (
      await POST(
        new Request("http://localhost/api/translate", {
          method: "POST",
          headers: { Origin: "https://other.example" },
          body: "{}",
        }),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await POST(
        new Request("http://localhost/api/translate", {
          method: "POST",
          body: "{broken",
        }),
      )
    ).status,
    400,
  );
});
test("same-language preserves input without upstream call", async () => {
  const response = await POST(
    request({ text: "名前は変えない", source: "ja", target: "ja" }),
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).provider, "identity");
  assert.equal(response.headers.get("cache-control"), "no-store");
});
test("AI provider preserves legacy persona and does not leak upstream errors or silently switch provider", async () => {
  const originalFetch = global.fetch,
    originalKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "test-key";
  try {
    let payload: any;
    global.fetch = (async (_url: unknown, options: RequestInit) => {
      payload = JSON.parse(options.body as string);
      return Response.json({ choices: [{ message: { content: "Xin chào" } }] });
    }) as typeof fetch;
    const response = await POST(
      request({ text: "こんにちは", persona: "secretary", tone: "polite" }),
    );
    const data = await response.json();
    assert.equal(data.translated, "Xin chào");
    assert.equal(data.source, "ja");
    assert.equal(data.target, "vi");
    assert.equal(data.toneApplied, true);
    assert.equal(payload.messages[1].content, "こんにちは");
    assert.match(payload.messages[0].content, /数字/);
    global.fetch = (async () =>
      new Response("private-provider-details", {
        status: 401,
      })) as typeof fetch;
    const failed = await POST(
      request({ text: "こんにちは", source: "ja", target: "vi" }),
    );
    assert.equal(failed.status, 502);
    assert.doesNotMatch(await failed.text(), /private-provider-details/);
    global.fetch = (async () =>
      Response.json({
        choices: [{ message: { content: "" } }],
      })) as typeof fetch;
    assert.equal(
      (await POST(request({ text: "こんにちは", source: "ja", target: "vi" })))
        .status,
      502,
    );
  } finally {
    global.fetch = originalFetch;
    if (originalKey) process.env.OPENROUTER_API_KEY = originalKey;
    else delete process.env.OPENROUTER_API_KEY;
  }
});
test("standard provider bounds chunks and reports quota without fabricated translations", async () => {
  const originalFetch = global.fetch,
    originalKey = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  try {
    let calls = 0;
    global.fetch = (async (input: string | URL) => {
      calls++;
      const url = new URL(input);
      assert.ok(
        new TextEncoder().encode(url.searchParams.get("q")!).length <= 480,
      );
      return Response.json({
        responseStatus: 200,
        responseData: { translatedText: "hello" },
      });
    }) as typeof fetch;
    const response = await POST(
      request({ text: "あ".repeat(500), source: "ja", target: "en" }),
    );
    assert.equal(response.status, 200);
    assert.equal(calls, 4);
    assert.equal((await response.json()).toneApplied, false);
    global.fetch = (async () =>
      Response.json({
        responseStatus: 403,
        quotaFinished: true,
        responseData: { translatedText: "LIMIT" },
      })) as typeof fetch;
    const failed = await POST(
      request({ text: "あ", source: "ja", target: "en" }),
    );
    assert.equal(failed.status, 503);
    assert.doesNotMatch(await failed.text(), /LIMIT/);
  } finally {
    global.fetch = originalFetch;
    if (originalKey) process.env.OPENROUTER_API_KEY = originalKey;
  }
});
