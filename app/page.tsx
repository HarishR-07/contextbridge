"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProjectState, TargetAI } from "@/lib/types";
import { buildContinuationPrompt } from "@/lib/continuation";
import { downloadZip } from "@/lib/export";
import { countTokens, TOKEN_MODELS, type TokenModel } from "@/lib/tokens";
import { ACCESS_KEY, AI_MODEL_KEY, AI_PROVIDER_KEY, postJson, setAiCredentials } from "@/lib/client";
import { scrubSecrets } from "@/lib/scrub";
import type { CodeFile } from "@/lib/zipfiles";
import { importState } from "@/lib/import";
import UpdatePanel from "@/components/UpdatePanel";
import CheckPanel from "@/components/CheckPanel";
import FeedbackPanel from "@/components/FeedbackPanel";
import { splitChunks, CHUNK_CHARS, MAX_CHUNKS } from "@/lib/chunk";
import HealthCard from "@/components/HealthCard";
import type { ShrinkMode } from "@/lib/shrink";
import TaskCheck from "@/components/TaskCheck";
import Optimizer from "@/components/Optimizer";
import CodebaseUpload from "@/components/CodebaseUpload";
import SnapshotEditor from "@/components/SnapshotEditor";
import SnapshotHistory from "@/components/SnapshotHistory";
import { importChatExport, type ImportedConversation } from "@/lib/chatImport";
import { diffStates, type Change } from "@/lib/diff";
import CloudProjects from "@/components/CloudProjects";
import { retainEvidenceProvenance, verifyEvidence } from "@/lib/evidence";

const TARGETS: { id: TargetAI; label: string }[] = [
  { id: "chatgpt", label: "ChatGPT" },
  { id: "claude", label: "Claude" },
  { id: "gemini", label: "Gemini" },
  { id: "generic", label: "Generic AI" },
];

function Block({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {items.length ? (
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-700">
          {items.map((i, n) => <li key={n}>{i}</li>)}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-slate-400">None recorded</p>
      )}
    </div>
  );
}

export default function Home() {
  const [text, setText] = useState("");
  const [state, setState] = useState<ProjectState | null>(null);
  const [target, setTarget] = useState<TargetAI>("chatgpt");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"snapshot" | "optimize" | "task">("snapshot");
  const [code, setCode] = useState<CodeFile[]>([]);
  const [redacted, setRedacted] = useState(0);
  const [progress, setProgress] = useState("");
  const [shrink, setShrink] = useState<ShrinkMode>("full");
  const [byokProvider, setByokProvider] = useState("");
  const [byokKey, setByokKey] = useState("");
  const [byokModel, setByokModel] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [chunkReview, setChunkReview] = useState<{ part: number; changes: Change[] }[]>([]);
  const [tokenModel, setTokenModel] = useState<TokenModel>("gpt-4o-mini");
  const [tokens, setTokens] = useState(0);
  const [promptTokens, setPromptTokens] = useState(0);
  const [importedConversations, setImportedConversations] = useState<ImportedConversation[]>([]);
  const [selectedImport, setSelectedImport] = useState("");

  useEffect(() => {
    let provider = "";
    let model = "";
    try {
      setAccessCode(sessionStorage.getItem(ACCESS_KEY) || "");
      provider = sessionStorage.getItem(AI_PROVIDER_KEY) || "";
      model = sessionStorage.getItem(AI_MODEL_KEY) || "";
      // Remove keys saved by earlier app versions; keys are memory-only now.
      sessionStorage.removeItem("cb_ai_key");
    } catch {}
    setByokProvider(provider);
    setByokModel(model);
    setAiCredentials(provider, "", model);
  }, []);

  async function importFile(file?: File) {
    if (!file) return;
    setError("");
    try {
      setState(await importState(file));
      setCode([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not import this file.");
    }
  }

  async function importChat(file?: File) {
    if (!file) return;
    setError("");
    setImportedConversations([]);
    setSelectedImport("");
    try {
      const conversations = await importChatExport(file);
      if (conversations.length === 1) { setText(conversations[0].text); setImportedConversations([]); setSelectedImport(""); }
      else { setImportedConversations(conversations); setSelectedImport(conversations[0].id); }
    }
    catch (e) { setError(e instanceof Error ? e.message : "Could not read this chat export."); }
  }

  function clearAll() {
    window.dispatchEvent(new Event("contextbridge-clear-all"));
    try { sessionStorage.removeItem(ACCESS_KEY); sessionStorage.removeItem(AI_PROVIDER_KEY); sessionStorage.removeItem(AI_MODEL_KEY); localStorage.removeItem("contextbridge_versions_v1"); localStorage.removeItem("contextbridge_handoff_outcomes_v1"); } catch {}
    setText("");
    setImportedConversations([]);
    setSelectedImport("");
    setState(null);
    setCode([]);
    setError("");
    setRedacted(0);
    setChunkReview([]);
    setByokProvider("");
    setByokKey("");
    setByokModel("");
    setAiCredentials("", "", "");
    setAccessCode("");
  }

  const prompt = useMemo(() => (state ? buildContinuationPrompt(state, target) : ""), [state, target]);

  useEffect(() => {
    let active = true;
    countTokens(text, tokenModel).then((n) => { if (active) setTokens(n); });
    return () => { active = false; };
  }, [text, tokenModel]);
  useEffect(() => {
    let active = true;
    countTokens(prompt, tokenModel).then((n) => { if (active) setPromptTokens(n); });
    return () => { active = false; };
  }, [prompt, tokenModel]);

  async function createSnapshot() {
    setLoading(true);
    setError("");
    try {
      const { text: clean, count } = scrubSecrets(text);
      setRedacted(count);
      const chunks = splitChunks(clean);
      setChunkReview([]);
      if (chunks.length > MAX_CHUNKS) throw new Error(`Input is too large (limit about ${(MAX_CHUNKS * CHUNK_CHARS).toLocaleString()} characters). Trim it or split it.`);
      let current: ProjectState | null = null;
      const reviews: { part: number; changes: Change[] }[] = [];
      for (let i = 0; i < chunks.length; i++) {
        if (chunks.length > 1) setProgress(`Processing part ${i + 1} of ${chunks.length}…`);
        try {
          const data: { state: ProjectState } = current
            ? await postJson("/api/update", { state: current, conversation: chunks[i] })
            : await postJson("/api/snapshot", { conversation: chunks[i] });
          if (current) reviews.push({ part: i + 1, changes: diffStates(current, data.state) });
          current = verifyEvidence(current ? retainEvidenceProvenance(data.state, current) : data.state, chunks[i], i + 1);
          setState(current);
          setChunkReview([...reviews]);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Something went wrong.";
          throw new Error(chunks.length > 1 ? `Part ${i + 1} of ${chunks.length} failed: ${msg}${i ? " Earlier parts were kept." : ""}` : msg);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
      setProgress("");
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Copy failed. Select the prompt text and copy it manually.");
    }
  }

  async function exportZip() {
    if (!state) return;
    try {
      await downloadZip(state, target, code, shrink);
    } catch {
      setError("Could not create the ZIP file. Please try again.");
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">ContextBridge</h1>
        <p className="mt-1 text-slate-600">Your AI projects, portable anywhere.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input type="password" aria-label="Access code" placeholder="Access code (if required)" value={accessCode} onChange={(e) => { setAccessCode(e.target.value); try { sessionStorage.setItem(ACCESS_KEY, e.target.value); } catch {} }} className="w-56 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600" />
          <select aria-label="AI provider" value={byokProvider} onChange={(e) => { const value = e.target.value; setByokProvider(value); if (!value) setByokKey(""); try { sessionStorage.setItem(AI_PROVIDER_KEY, value); } catch {} setAiCredentials(value, value ? byokKey : "", byokModel); }} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">Choose your provider</option><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="gemini">Google Gemini</option>
          </select>
          <input type="password" aria-label="Your provider API key" autoComplete="off" placeholder="Your provider API key" value={byokKey} onChange={(e) => { setByokKey(e.target.value); setAiCredentials(byokProvider, e.target.value, byokModel); }} className="w-56 rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
          <input type="text" aria-label="Model ID" autoComplete="off" placeholder="Model ID (optional)" value={byokModel} onChange={(e) => { const value = e.target.value; setByokModel(value); try { sessionStorage.setItem(AI_MODEL_KEY, value); } catch {} setAiCredentials(byokProvider, byokKey, value); }} className="w-48 rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
          <button onClick={clearAll} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-600">Clear current data and history</button>
        </div>
      </header>

      <details className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
        <summary className="cursor-pointer font-semibold">Known limits and trust notes</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-700">
          <li>The code is mostly prompt design and integration plumbing; defensibility depends on the format, measured quality and distribution.</li>
          <li>Handoff quality is not established. The included evaluation set is synthetic and cannot predict real receiving-model success.</li>
          <li>Exact evidence quotes are checked against the source chunk and labeled with their part number. A matching quote does not prove the claim is correctly interpreted. Chunk review lists field changes but cannot automatically judge semantic accuracy.</li>
          <li>OpenAI token counts use a model encoding but omit chat framing; Claude/Gemini remain rough. Import parsing and import-link detection are best effort.</li>
          <li>Cloud projects and cross-device versions need a configured Supabase project and the updated schema. Local history stays in this browser. The extension captures rendered text after you click; virtualized or collapsed history may be absent.</li>
          <li>Secret scrubbing and ZIP filtering are incomplete. Review sensitive text and selected files before sending or exporting.</li>
          <li>AI features require your own OpenAI, Anthropic, or Gemini API key. The key is held in memory and passed through the app server to that provider; re-enter it after a reload. Use a local or trusted deployment; API usage is billed by your provider.</li>
        </ul>
      </details>

      <div className="mb-6 flex gap-2" role="tablist">
        {([["snapshot", "Create snapshot"], ["optimize", "Optimize context"], ["task", "Task check"]] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-600 ${tab === id ? "bg-slate-900 text-white" : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === "optimize" ? <Optimizer /> : tab === "task" ? <TaskCheck /> : (<>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="mb-3 inline-block cursor-pointer text-sm font-medium text-teal-700 underline focus-within:ring-2 focus-within:ring-teal-600">
          Import existing project (.json or .zip)
          <input type="file" accept=".json,.zip" aria-label="Import existing project" className="sr-only" onChange={(e) => { importFile(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        <label className="mb-3 ml-4 inline-block cursor-pointer text-sm font-medium text-teal-700 underline focus-within:ring-2 focus-within:ring-teal-600">
          Import chat export (JSON or ZIP)
          <input type="file" accept=".json,.zip" aria-label="Import official chat export" className="sr-only" onChange={(e) => { importChat(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        {importedConversations.length > 1 && <div className="mb-3 rounded-lg bg-slate-50 p-3"><label htmlFor="import-chat-select" className="block text-sm font-medium">Choose one conversation from the export</label><select id="import-chat-select" value={selectedImport} onChange={(e) => setSelectedImport(e.target.value)} className="mt-2 w-full rounded border border-slate-300 p-2 text-sm">{importedConversations.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select><button onClick={() => { const conversation = importedConversations.find((c) => c.id === selectedImport); if (conversation) setText(conversation.text); }} className="mt-2 rounded bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white">Load selected conversation</button><p className="mt-1 text-xs text-slate-500">Imported {importedConversations.length} chats separately. Select one to avoid mixing unrelated projects.</p></div>}
        <br />
        <label htmlFor="ctx" className="font-semibold">Paste your conversation or project notes</label>
        <textarea
          id="ctx"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder="Paste the chat you want to continue elsewhere…"
          className="mt-2 w-full resize-y rounded-lg border border-slate-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
        />
        <p className="mt-2 text-xs text-slate-500">
          Your text is scrubbed for common secrets and sent to the provider you select using your API key. The key is held in page memory and passes through this app server; it is cleared on reload. Use a local or trusted deployment. Your provider bills you and handles submitted text under its terms. ContextBridge does not persist conversation text on its server. Review sensitive material before sending.
        </p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <label className="text-sm text-slate-500">Token model{" "}<select value={tokenModel} onChange={(e) => setTokenModel(e.target.value as TokenModel)} className="rounded border border-slate-300 bg-white px-1 py-0.5 text-xs">{TOKEN_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select><span className="ml-2">About {tokens.toLocaleString()} tokens</span></label>
          <button
            onClick={createSnapshot}
            disabled={loading || text.trim().length < 50}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
          >
            {loading ? progress || "Creating snapshot…" : "Create project snapshot"}
          </button>
        </div>
        {redacted > 0 && <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800">{redacted} possible secret(s) were redacted before sending.</p>}
        {error && <p role="alert" className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </section>

      {state && (
        <section className="mt-6 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold">{state.project.name || "Untitled project"}</h2>
            {state.project.description && <p className="mt-1 text-sm text-slate-600">{state.project.description}</p>}
            <HealthCard state={state} promptTokens={promptTokens} tokenModel={tokenModel} />
            {state.evidence.length > 0 && <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm"><strong>Evidence and source checks</strong><p className="text-xs text-amber-800">Exact text matching confirms only that the quote appears in the source; it does not confirm the claim’s interpretation.</p><ul className="mt-2 list-disc space-y-1 pl-5">{state.evidence.map((e, i) => <li key={i}><span className="font-medium">{e.verified ? "Exact quote found" : "Quote not found"}{e.sourcePart ? ` · part ${e.sourcePart}` : ""} — {e.claim}:</span> “{e.quote}”</li>)}</ul></div>}
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold">Current task</h3>
                <p className="mt-1 text-sm text-slate-700">{state.current_task.title || "Not specified"}</p>
              </div>
              <Block title="Completed" items={state.completed_tasks} />
              <Block title="Known issues" items={state.known_issues} />
              <Block title="Next steps" items={state.next_steps} />
            </div>
          </div>

          <SnapshotEditor state={state} onChange={setState} />
          {chunkReview.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm"><strong>Long-chat change review</strong><p className="mt-1 text-xs text-amber-800">Every detected field change is listed per part. Review removals and wording changes; this detects structural drift, not whether a claim is semantically correct.</p>{chunkReview.map(({ part, changes }) => <div key={part} className="mt-2"><strong>After part {part}:</strong>{changes.length ? changes.map((c) => <div key={c.section} className="mt-1"><span className="font-medium">{c.section}</span><ul className="list-disc pl-5">{c.added.map((x, i) => <li key={`a${i}`} className="text-emerald-800">Added: {x}</li>)}{c.removed.map((x, i) => <li key={`r${i}`} className="text-rose-800">Removed: {x}</li>)}</ul></div>) : <p className="text-xs text-slate-600">No state changes detected.</p>}</div>)}</div>}
          <SnapshotHistory state={state} onRestore={setState} />
          <CloudProjects state={state} onLoad={setState} />

          <CodebaseUpload state={state} code={code} shrink={shrink} onShrink={setShrink} onCode={setCode} onRelevant={(files) => setState((s) => (s ? { ...s, files } : s))} />

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Continue with another AI</h2>
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Destination AI">
              {TARGETS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTarget(t.id)}
                  aria-pressed={target === t.id}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-600 ${
                    target === t.id ? "border-teal-700 bg-teal-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <textarea
              readOnly
              value={prompt}
              rows={12}
              aria-label="Continuation prompt"
              className="mt-3 w-full resize-y rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={copyPrompt} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2">
                {copied ? "Copied" : "Copy prompt"}
              </button>
              <button onClick={exportZip} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2">
                Download project state (ZIP)
              </button>
            </div>
          </div>
          <UpdatePanel state={state} onUpdate={setState} />
          <CheckPanel state={state} />
          <FeedbackPanel />
        </section>
      )}
      </>)}
    </main>
  );
}
