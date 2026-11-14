"use client";

import { useEffect, useState } from "react";
import type { ProjectState } from "@/lib/types";
import { diffStates } from "@/lib/diff";

type Version = { id: string; name: string; savedAt: string; state: ProjectState };
const KEY = "contextbridge_versions_v1";
function read(): Version[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}

export default function SnapshotHistory({ state, onRestore }: { state: ProjectState; onRestore: (s: ProjectState) => void }) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [compareId, setCompareId] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    setVersions(read());
    const clear = () => { localStorage.removeItem(KEY); setVersions([]); setCompareId(""); };
    window.addEventListener("contextbridge-clear-all", clear);
    return () => window.removeEventListener("contextbridge-clear-all", clear);
  }, []);
  function save() {
    try {
      const next = [{ id: crypto.randomUUID(), name: state.project.name || "Untitled project", savedAt: new Date().toISOString(), state }, ...read()].slice(0, 20);
      localStorage.setItem(KEY, JSON.stringify(next)); setVersions(next); setMessage("Version saved in this browser.");
    } catch { setMessage("Browser storage is unavailable; export a ZIP to keep this version."); }
  }
  const selected = versions.find((v) => v.id === compareId);
  const changes = selected ? diffStates(selected.state, state) : [];
  return <details className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <summary className="cursor-pointer font-semibold">Version history</summary>
    <p className="mt-2 text-xs text-slate-500">Opt-in, browser-local history (up to 20 versions). It persists in this browser profile until cleared. Anyone using this browser profile may be able to access it.</p>
      <button onClick={save} className="mt-3 rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white">Save this version</button>
    {message && <p role="status" className="mt-2 text-xs text-slate-600">{message}</p>}
    {versions.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
      <select aria-label="Choose version to compare or restore" value={compareId} onChange={(e) => setCompareId(e.target.value)} className="rounded border border-slate-300 p-2 text-sm">
        <option value="">Choose a saved version</option>{versions.map((v) => <option key={v.id} value={v.id}>{new Date(v.savedAt).toLocaleString()} — {v.name}</option>)}
      </select>
      <button disabled={!selected} onClick={() => selected && onRestore(selected.state)} className="rounded border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40">Restore</button>
      <button onClick={() => { localStorage.removeItem(KEY); setVersions([]); setCompareId(""); }} className="rounded border border-slate-300 px-3 py-1.5 text-sm">Clear history</button>
    </div>}
    {selected && <div className="mt-3 text-sm"><strong>Changes from saved version to current:</strong>{changes.length ? changes.map((c) => <p key={c.section} className="mt-1">{c.section}: +{c.added.length} / −{c.removed.length}</p>) : <p>No differences detected.</p>}</div>}
  </details>;
}
