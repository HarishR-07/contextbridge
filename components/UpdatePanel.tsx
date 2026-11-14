"use client";

import { useState } from "react";
import type { ProjectState } from "@/lib/types";
import { postJson } from "@/lib/client";
import { scrubSecrets } from "@/lib/scrub";
import { diffStates, type Change } from "@/lib/diff";
import { retainEvidenceProvenance, verifyEvidence } from "@/lib/evidence";

export default function UpdatePanel({ state, onUpdate }: { state: ProjectState; onUpdate: (s: ProjectState) => void }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [redacted, setRedacted] = useState(0);
  const [changes, setChanges] = useState<Change[] | null>(null);

  async function run() {
    setLoading(true);
    setError("");
    try {
      const { text: clean, count } = scrubSecrets(text);
      setRedacted(count);
      const data = await postJson<{ state: ProjectState }>("/api/update", { state, conversation: clean });
      setChanges(diffStates(state, data.state));
      onUpdate(verifyEvidence(retainEvidenceProvenance(data.state, state), clean));
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold">Update this snapshot</h2>
      <p className="mt-1 text-xs text-slate-500">Paste only the new part of the conversation. The snapshot is updated, not rebuilt.</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} aria-label="New conversation" placeholder="Paste what happened since the last snapshot…"
        className="mt-2 w-full resize-y rounded-lg border border-slate-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600" />
      <button onClick={run} disabled={loading || text.trim().length < 50}
        className="mt-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2">
        {loading ? "Updating…" : "Update snapshot"}
      </button>
      {redacted > 0 && <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800">{redacted} possible secret(s) were redacted before sending.</p>}
      {error && <p role="alert" className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {changes && (
        <div className="mt-4 text-sm">
          <h3 className="font-semibold">{changes.length ? "What changed" : "No changes detected"}</h3>
          {changes.map((c) => (
            <div key={c.section} className="mt-2">
              <div className="font-medium text-slate-800">{c.section}</div>
              <ul className="space-y-0.5">
                {c.added.map((x, i) => <li key={`a${i}`} className="text-emerald-700">+ {x}</li>)}
                {c.removed.map((x, i) => <li key={`r${i}`} className="text-slate-500 line-through">{x}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
