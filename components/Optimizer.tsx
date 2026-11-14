"use client";

import { useState } from "react";
import { postJson } from "@/lib/client";
import { scrubSecrets } from "@/lib/scrub";
import type { OptimizeReport } from "@/lib/optimize";

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg bg-slate-50 p-3">
    <div className="text-xs text-slate-500">{label}</div>
    <div className="text-lg font-semibold">{value}</div>
  </div>
);

export default function Optimizer() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ optimized: string; report: OptimizeReport } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [redacted, setRedacted] = useState(0);

  async function run() {
    setLoading(true);
    setError("");
    try {
            const { text: clean, count } = scrubSecrets(text);
      setRedacted(count);
      const data = await postJson<{ optimized: string; report: OptimizeReport }>("/api/optimize", { text: clean });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(result?.optimized ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Copy failed. Select the text and copy it manually.");
    }
  }

  const r = result?.report;
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label htmlFor="opt" className="font-semibold">Paste the context you want to shrink</label>
        <textarea id="opt" value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder="Paste a long prompt, conversation or project notes…"
          className="mt-2 w-full resize-y rounded-lg border border-slate-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600" />
        <p className="mt-2 text-xs text-slate-500">Sent once to the AI provider. Not stored or logged. Token counts are estimates.</p>
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={() => { setText(""); setResult(null); setError(""); setRedacted(0); }} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-600">Clear</button>
          <button onClick={run} disabled={loading || text.trim().length < 200}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2">
            {loading ? "Optimizing…" : "Optimize context"}
          </button>
        </div>
        {redacted > 0 && <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800">{redacted} possible secret(s) were redacted before sending.</p>}
        {error && <p role="alert" className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </section>
      {result && r && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Original (rough tokens)" value={`${r.original.toLocaleString()}`} />
            <Stat label="Exact duplicates removed (rough tokens)" value={`${r.duplicate.toLocaleString()}`} />
            <Stat label="Optimized (rough tokens)" value={`${r.optimized.toLocaleString()}`} />
            <Stat label="Reduction" value={`${r.reduction}%`} />
          </div>
          <textarea readOnly value={result.optimized} rows={14} aria-label="Optimized context" className="mt-4 w-full resize-y rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs" />
          <button onClick={copy} className="mt-3 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2">
            {copied ? "Copied" : "Copy optimized context"}
          </button>
        </section>
      )}
    </div>
  );
}
