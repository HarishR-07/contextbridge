"use client";

import { useMemo, useState } from "react";
import type { ProjectState } from "@/lib/types";
import { buildCheck, checkPrompt } from "@/lib/check";

export default function CheckPanel({ state }: { state: ProjectState }) {
  const [copied, setCopied] = useState(false);
  const items = useMemo(() => buildCheck(state), [state]);
  const prompt = useMemo(() => checkPrompt(items), [items]);
  if (!items.length) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold">Check the handoff</h2>
      <p className="mt-1 text-xs text-slate-500">After pasting the continuation prompt into the new AI, send these questions. Compare its answers with the expected ones.</p>
      <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs">{prompt}</pre>
      <button onClick={copy} className="mt-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-600">
        {copied ? "Copied" : "Copy questions"}
      </button>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-medium">Expected answers</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-700">{items.map((i, n) => <li key={n}><span className="font-medium">{i.q}</span> {i.a}</li>)}</ol>
      </details>
    </div>
  );
}
