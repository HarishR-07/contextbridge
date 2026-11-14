import assert from "node:assert/strict";
import JSZip from "jszip";
import { guard, readJson } from "../lib/guard";
import { scrubSecrets } from "../lib/scrub";
import { isSafePath, readCodebase } from "../lib/zipfiles";
import { importState } from "../lib/import";
import { AppError } from "../lib/errors";
import { getProvider } from "../lib/ai/provider";

const env = process.env as Record<string, string | undefined>;
let n = 0;
const req = (headers: Record<string, string> = {}, ip = `10.0.0.${++n}`) =>
  new Request("http://app.test/api/x", { method: "POST", headers: { "content-type": "application/json", host: "app.test", "x-real-ip": ip, ...headers }, body: "{}" });
const status = (fn: () => void) => { try { fn(); return 200; } catch (e) { return e instanceof AppError ? e.status : -1; } };

async function main() {
  const t = (name: string, fn: () => void | Promise<void>) => Promise.resolve(fn()).then(() => console.log("ok  " + name));
  env.NODE_ENV = "production"; delete env.ACCESS_CODE; delete env.ALLOW_PUBLIC; delete env.RATE_LIMIT_PER_MIN;

  await t("BYOK is required and never falls back to deployment API keys", () => {
    env.OPENAI_API_KEY = "deployment-secret-must-not-be-used";
    assert.throws(() => getProvider(new Headers()), (e: unknown) => e instanceof AppError && e.status === 400);
    assert.throws(() => getProvider(new Headers({ "x-ai-provider": "openai" })), (e: unknown) => e instanceof AppError && e.status === 400);
    assert.equal(getProvider(new Headers({ "x-ai-provider": "openai", "x-ai-key": "user-key" })).name, "openai");
    assert.equal(getProvider(new Headers({ "x-ai-provider": "gemini", "x-ai-key": "user-key", "x-ai-model": "gemini-test" })).name, "gemini");
    assert.throws(() => getProvider(new Headers({ "x-ai-provider": "gemini", "x-ai-key": "user-key", "x-ai-model": "../attacker" })), (e: unknown) => e instanceof AppError && e.status === 400);
    delete env.OPENAI_API_KEY;
  });
  await t("BYOK adapters send credentials only to fixed provider hosts", async () => {
    const previousFetch = globalThis.fetch;
    const seen: { url: string; headers: Headers; body: any }[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({ url: String(input), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
      const url = String(input);
      const response = url.includes("anthropic.com")
        ? { content: [{ type: "text", text: "{}" }] }
        : url.includes("googleapis.com")
          ? { candidates: [{ content: { parts: [{ text: "{}" }] } }] }
          : { choices: [{ message: { content: "{}" } }] };
      return new Response(JSON.stringify(response), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
    try {
      await getProvider(new Headers({ "x-ai-provider": "openai", "x-ai-key": "openai-user-key", "x-ai-model": "gpt-test" })).complete("sys", "user");
      await getProvider(new Headers({ "x-ai-provider": "anthropic", "x-ai-key": "anthropic-user-key", "x-ai-model": "claude-test" })).complete("sys", "user");
      await getProvider(new Headers({ "x-ai-provider": "gemini", "x-ai-key": "gemini-user-key", "x-ai-model": "gemini-test" })).complete("sys", "user");
      assert.equal(seen[0].url, "https://api.openai.com/v1/chat/completions");
      assert.equal(seen[0].headers.get("authorization"), "Bearer openai-user-key");
      assert.equal(seen[0].body.model, "gpt-test");
      assert.equal(seen[1].url, "https://api.anthropic.com/v1/messages");
      assert.equal(seen[1].headers.get("x-api-key"), "anthropic-user-key");
      assert.equal(seen[1].body.model, "claude-test");
      assert.match(seen[2].url, /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-test:generateContent$/);
      assert.equal(seen[2].headers.get("x-goog-api-key"), "gemini-user-key");
      assert.equal(seen[2].body.generationConfig.responseMimeType, "application/json");
    } finally { globalThis.fetch = previousFetch; }
  });

  await t("production fails closed without ACCESS_CODE", () => {
    assert.equal(status(() => guard(req())), 503);
    env.ALLOW_PUBLIC = "true"; assert.equal(status(() => guard(req())), 200); delete env.ALLOW_PUBLIC;
  });
  env.ACCESS_CODE = "correct-horse-battery-staple";
  await t("access code: missing, wrong and right", () => {
    assert.equal(status(() => guard(req())), 401);
    assert.equal(status(() => guard(req({ "x-access-code": "wrong" }))), 401);
    assert.equal(status(() => guard(req({ "x-access-code": env.ACCESS_CODE! }))), 200);
  });
  const ok = { "x-access-code": "correct-horse-battery-staple" };
  await t("cross-origin and non-JSON requests are rejected", () => {
    assert.equal(status(() => guard(req({ ...ok, origin: "https://evil.example" }))), 403);
    assert.equal(status(() => guard(req({ ...ok, origin: "http://app.test" }))), 200);
    assert.equal(status(() => guard(req({ ...ok, "content-type": "text/plain" }))), 415);
  });
  await t("rate limit applies to wrong-code guesses too", () => {
    const ip = "9.9.9.9"; let last = 0;
    for (let i = 0; i < 21; i++) last = status(() => guard(req({ "x-access-code": "guess" + i }, ip)));
    assert.equal(last, 429);
  });
  await t("request body size cap", async () => {
    const big = new Request("http://app.test/x", { method: "POST", body: "x".repeat(2_000_000) });
    await assert.rejects(() => readJson(big), (e: unknown) => e instanceof AppError && e.status === 413);
    assert.deepEqual(await readJson(new Request("http://app.test/x", { method: "POST", body: '{"a":1}' })), { a: 1 });
    assert.equal(await readJson(new Request("http://app.test/x", { method: "POST", body: "nope" })), null);
  });
  await t("unsafe zip paths rejected", async () => {
    for (const p of ["../evil.sh", "a/../../b", "/etc/passwd", "a\\b", "a/./../x"]) assert.equal(isSafePath(p), false, p);
    for (const p of ["src/a.ts", "a..b/c.ts", "README.md"]) assert.equal(isSafePath(p), true, p);
    const z = new JSZip(); z.file("proj/ok.ts", "x"); z.file("proj/../escape.ts", "y"); z.file("proj/a/../../b.ts", "z");
    const r = await readCodebase(new Blob([await z.generateAsync({ type: "arraybuffer" })]));
    assert.ok(r.files.every((f) => isSafePath(f.path)));
  });
  await t("import rejects oversized ZIP entries and files", async () => {
    await assert.rejects(() => importState(new Blob([new Uint8Array(50_000_001)])));
  });
  await t("scrubber still redacts real secrets after hardening", () => {
    const r = scrubSecrets("a postgres://user:pa55word@db.example.com:5432/x b\n-----BEGIN RSA PRIVATE KEY-----\nMIIabc\n-----END RSA PRIVATE KEY-----\n tail eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop API_KEY=abcdefgh12345");
    assert.equal(r.count, 4); assert.ok(!/pa55word|MIIabc|eyJhbGci|abcdefgh12345/.test(r.text)); assert.ok(r.text.includes("tail"));
    assert.equal(scrubSecrets("-----BEGIN PRIVATE KEY----- no end here").count, 0);
  });
  await t("scrubber has no catastrophic slowdown on hostile input", () => {
    for (const s of ["a".repeat(1_000_000), "password=".repeat(50_000), "postgres://".repeat(50_000), "Bearer ".repeat(100_000), "-----BEGIN PRIVATE KEY-----".repeat(20_000), ("token: " + "a1".repeat(40)).repeat(20_000), "eyJ".repeat(300_000), "TOKEN".repeat(100_000), "AKIA" + "a".repeat(1_000_000), "sk-".repeat(300_000)]) {
      const t0 = Date.now(); scrubSecrets(s); assert.ok(Date.now() - t0 < 3000, "slow on " + s.slice(0, 20));
    }
  });
}
main().catch((e) => { console.error(e); process.exit(1); });
