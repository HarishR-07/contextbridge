import assert from "node:assert/strict";
import JSZip from "jszip";
import { scrubSecrets } from "../lib/scrub";
import { normalizeState, parseJson } from "../lib/normalize";
import { dedupeParagraphs, buildReport } from "../lib/optimize";
import { readCodebase } from "../lib/zipfiles";
import { diffStates } from "../lib/diff";
import { buildCheck } from "../lib/check";
import { importState } from "../lib/import";
import { stateToFiles } from "../lib/export";
import { buildContinuationPrompt } from "../lib/continuation";
import { evaluate, normalizePlan } from "../lib/taskcheck";
import { splitChunks } from "../lib/chunk";
import { completeness } from "../lib/completeness";
import { shrinkFile, shrinkReport } from "../lib/shrink";
import { computeHealth } from "../lib/health";
import { verifyEvidence, retainEvidenceProvenance } from "../lib/evidence";
import { importChatExport } from "../lib/chatImport";
import { upsertSavedProject, restoreProjectVersion, type AccountSession, type SavedProject, type SavedProjectVersion } from "../lib/savedProjects";

async function main() {
  const full = normalizeState({ project: { name: "X", goal: "g" }, architecture: ["a"], decisions: [{ decision: "d", reason: "r" }], constraints: ["c"], current_task: { title: "t" }, next_steps: ["n"], failed_approaches: ["f"], conversation_summary: "s", known_issues: ["bug"], completed_tasks: ["done"] });
  const t = (name: string, fn: () => void | Promise<void>) => Promise.resolve(fn()).then(() => console.log("ok  " + name));

  await t("scrub redacts secrets without false positives", () => {
    const r = scrubSecrets("key sk-ant-api03-abcdefghijklmnopqrstuvwx\nDB postgres://u:pa55word@h:5/d\npassword: hunter2hunter2");
    assert.equal(r.count, 3);
    assert.ok(!/sk-ant|pa55word|hunter2/.test(r.text));
    assert.equal(scrubSecrets("token: string and a risk-assessment flow").count, 0);
  });
  await t("normalize + parseJson tolerate messy AI output", () => {
    const s = normalizeState(parseJson('Sure: {"project":{"name":"X"},"decisions":["a",5],"completed_tasks":"bad"}'));
    assert.equal(s.project.name, "X"); assert.equal(s.decisions.length, 1); assert.equal(s.completed_tasks.length, 0);
    assert.throws(() => parseJson("no json"));
  });
  await t("dedupe + report", () => {
    const p = "A long repeated paragraph about the OAuth callback bug in the app.";
    assert.equal(dedupeParagraphs(`${p}\n\nx\n\n${p.toUpperCase()}`).removedChars, p.length);
    assert.equal(buildReport("a".repeat(400), 0, "a".repeat(200)).reduction, 50);
    assert.equal(buildReport("abcd", 0, "x".repeat(40)).reduction, 0);
  });
  await t("zip reader skips secrets, binaries, big files", async () => {
    const z = new JSZip();
    z.file("p/src/a.ts", "x"); z.file("p/.env", "S=1"); z.file("p/node_modules/x.js", "x"); z.file("p/logo.png", "x"); z.file("p/big.txt", "x".repeat(250_000));
    const r = await readCodebase(new Blob([await z.generateAsync({ type: "arraybuffer" })]));
    assert.deepEqual(r.files.map((f) => f.path).sort(), ["big.txt", "src/a.ts"]);
    assert.equal(r.files.find((f) => f.path === "big.txt")!.content, null);
    await assert.rejects(() => readCodebase(new Blob(["nope"])));
  });
  await t("diff + handoff check", () => {
    const b = normalizeState({ ...full, known_issues: [] });
    assert.equal(diffStates(full, b).find((c) => c.section === "Known issues")!.removed[0], "bug");
    assert.equal(diffStates(full, full).length, 0);
    assert.equal(buildCheck(full).length, 6);
  });
  await t("evidence verification is exact, chunk-labeled, and retained across merges", () => {
    const sourceState = normalizeState({ ...full, evidence: [{ claim: "Goal", quote: "Ship the app" }, { claim: "Fake", quote: "made up words" }] });
    const checked = verifyEvidence(sourceState, "Earlier text.\nShip   the app today.", 3);
    assert.equal(checked.evidence[0].verified, true);
    assert.equal(checked.evidence[0].sourcePart, 3);
    assert.equal(checked.evidence[1].verified, false);
    const carried = retainEvidenceProvenance(normalizeState({ ...full, evidence: sourceState.evidence }), checked);
    assert.equal(carried.evidence[0].sourcePart, 3);
  });
  await t("chat JSON importer handles ChatGPT mapping and Claude/Gemini message arrays", async () => {
    const asFile = (name: string, value: unknown) => Object.assign(new Blob([JSON.stringify(value)]), { name }) as File;
    const chatgptData = [{ mapping: { a: { message: { author: { role: "user" }, content: { parts: ["A sufficiently long question about the project and its current implementation?"] }, create_time: 1 } }, b: { message: { author: { role: "assistant" }, content: { parts: ["A sufficiently detailed answer describing the project implementation and next steps."] }, create_time: 2 } } } }];
    const chatgpt = await importChatExport(asFile("conversations.json", chatgptData));
    assert.equal(chatgpt.length, 1);
    assert.match(chatgpt[0].text, /user: A sufficiently long question[\s\S]*assistant: A sufficiently detailed answer/);
    const other = await importChatExport(asFile("export.json", { conversations: [{ chat_messages: [{ sender: "human", text: "A sufficiently long question about the project?" }, { sender: "assistant", content: [{ text: "A sufficiently detailed answer for import testing." }] }] }] }));
    assert.equal(other.length, 1);
    assert.match(other[0].text, /human: A sufficiently long question/);
    assert.match(other[0].text, /assistant: A sufficiently detailed answer/);
    const multiple = await importChatExport(asFile("chats.json", { conversations: [{ title: "Alpha", messages: [{ role: "user", text: "A distinct conversation about project alpha." }] }, { title: "Beta", messages: [{ role: "user", text: "A separate conversation about project beta." }] }] }));
    assert.equal(multiple.length, 2);
    assert.deepEqual(multiple.map((c) => c.title), ["Alpha", "Beta"]);
    const archive = new JSZip(); archive.file("conversations.json", JSON.stringify({ conversations: [{ title: "ZIP Alpha", messages: [{ role: "user", text: "A distinct conversation stored in the archive." }] }, { title: "ZIP Beta", messages: [{ role: "user", text: "Another separate archived conversation." }] }] }));
    const zipped = Object.assign(new Blob([await archive.generateAsync({ type: "arraybuffer" })]), { name: "chat-export.zip" }) as File;
    assert.deepEqual((await importChatExport(zipped)).map((c) => c.title), ["ZIP Alpha", "ZIP Beta"]);
  });
  await t("cloud saves version prior/current states and restore creates another version", async () => {
    const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL; const oldAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const oldFetch = globalThis.fetch;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://contextbridge-test.supabase.co"; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    const session: AccountSession = { access_token: "token", refresh_token: "refresh", expires_at: Math.floor(Date.now() / 1000) + 3600, user_id: "user-1" };
    const previous = { id: "project-1", name: "X", state: full, updated_at: "2026-01-01T00:00:00Z" } satisfies SavedProject;
    const nextState = normalizeState({ ...full, project: { ...full.project, goal: "New goal" } });
    const next = { ...previous, state: nextState, updated_at: "2026-02-01T00:00:00Z" } satisfies SavedProject;
    const oldVersion = { id: "version-1", project_id: "project-1", name: "X", state: full, created_at: "2026-01-01T00:00:00Z" } satisfies SavedProjectVersion;
    const requests: { url: string; method: string; body?: any }[] = [];
    let currentProject = previous;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input); const method = init?.method || "GET"; const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      requests.push({ url, method, body });
      let data: any = [];
      if (url.includes("saved_project_versions") && url.includes("id=eq.version-1")) data = [oldVersion];
      else if (url.includes("saved_projects?") && method === "GET") data = url.includes("id=eq.project-1") ? [currentProject] : [];
      else if (url.includes("saved_projects?") && method === "PATCH") { currentProject = { ...currentProject, state: body.state, updated_at: "2026-02-01T00:00:00Z" }; data = [currentProject]; }
      return new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
    try {
      await upsertSavedProject(session, "X", nextState, "project-1");
      assert.equal(requests.filter((r) => r.url.includes("saved_project_versions") && r.method === "POST").length, 2);
      assert.deepEqual(requests.filter((r) => r.url.includes("saved_project_versions") && r.method === "POST").map((r) => r.body.state.project.goal), [full.project.goal, nextState.project.goal]);
      requests.length = 0;
      const restored = await restoreProjectVersion(session, "project-1", "version-1");
      assert.equal(restored.project.state.project.goal, full.project.goal);
      assert.equal(requests.filter((r) => r.url.includes("saved_project_versions") && r.method === "POST").length, 2);
    } finally {
      globalThis.fetch = oldFetch;
      if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
      if (oldAnon === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = oldAnon;
    }
  });
  await t("import json and zip, reject bad files", async () => {
    const json = JSON.stringify(full);
    assert.equal((await importState(new Blob([json]))).project.name, "X");
    const z = new JSZip(); z.folder("PROJECT_STATE")!.file("project_state.json", json);
    assert.equal((await importState(new Blob([await z.generateAsync({ type: "arraybuffer" })]))).project.name, "X");
    await assert.rejects(() => importState(new Blob(["{}"])));
  });
  await t("export + prompts", () => {
    assert.equal(Object.keys(stateToFiles(full, "claude")).length, 17);
    assert.ok(buildContinuationPrompt(full, "claude").includes("<project_state>"));
  });
  await t("task check verdicts and splitting", () => {
    const st = (r: number[]) => r.map((replies, i) => ({ title: `s${i}`, replies, note: "" }));
    assert.equal(evaluate(st([1, 2, 1]), 20, 100).verdict, "fits");
    assert.equal(evaluate(st([4, 4, 4]), 20, 75).verdict, "tight");
    const e = evaluate(st([5, 5, 5, 5]), 20, 25);
    assert.equal(e.verdict, "cutoff"); assert.equal(e.parts.flat().length, 4);
    assert.equal(normalizePlan({ steps: [{ title: "A", replies: 99 }] })[0].replies, 10);
  });
  await t("chunking keeps all text and merges tiny tails", () => {
    const big = splitChunks("a".repeat(150_000));
    assert.ok(big.every((c) => c.length <= 60_000)); assert.equal(big.reduce((n, c) => n + c.length, 0), 150_000);
    assert.equal(splitChunks("a".repeat(60_000) + "\n\ntail short").length, 1);
    assert.equal(splitChunks(["p1", "p2", "p3"].map((p) => p.repeat(20_000)).join("\n\n")).length, 3);
  });
  await t("completeness", () => {
    assert.equal(completeness(full).percent, 100);
    assert.deepEqual(completeness(normalizeState({ project: { name: "Y" } })).missing.length, 7);
  });
  await t("shrink: compact keeps code and directives, outline keeps declarations", () => {
    const ts = "// plain comment\n// @ts-ignore\n/**\n * doc\n */\nexport function a() {\n  const u = 'http://x.com'; // trailing\n\n\n\n  return 1;\n}\n";
    const c = shrinkFile("a.ts", ts, "compact");
    assert.ok(!c.includes("plain comment") && !c.includes("doc") && c.includes("@ts-ignore") && c.includes("http://x.com") && !/\n\n\n/.test(c));
    const py = shrinkFile("a.py", "#!/usr/bin/env python\n# note\ndef f():\n    return '#not'\n", "compact");
    assert.ok(py.includes("#!/usr") && !py.includes("# note") && py.includes("'#not'"));
    const o = shrinkFile("a.ts", "export class A {\n  run(x: number) {\n    if (x) {\n      y();\n    }\n  }\n}\nconst f = (a) => a;\n", "outline");
    assert.ok(o.includes("class A") && o.includes("run(x: number)") && !o.includes("if (x)") && o.includes("const f"));
    assert.equal(shrinkFile("a.ts", "x", "full"), "x");
    assert.ok(shrinkFile("a.md", "l\n".repeat(100), "outline").includes("more lines omitted"));
    const r = shrinkReport([{ path: "a.ts", size: 9, content: ts }, { path: "b.ts", size: 9, content: null }], ["a.ts", "b.ts"], "compact");
    assert.ok(r.before > r.after && r.saved > 0);
  });
  await t("health score is bounded, explained and rewards completeness", () => {
    const hi = computeHealth(full, 1000, 16000);
    assert.ok(hi.score >= 0 && hi.score <= 100 && hi.factors.reduce((n, f) => n + f.max, 0) === 100);
    const empty = computeHealth(normalizeState({}), 1000, 16000);
    assert.ok(empty.score < hi.score && empty.band === "At risk");
    assert.ok(computeHealth(full, 40000, 16000).score < hi.score);
    assert.ok(computeHealth(normalizeState({ ...full, known_issues: ["1", "2", "3", "4", "5", "6"] }), 1000, 16000).factors[3].points === 0);
  });
}
main().catch((e) => { console.error(e); process.exit(1); });
