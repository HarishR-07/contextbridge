"use client";

import { useEffect, useState } from "react";
import { postJson } from "@/lib/client";

type Result = "yes" | "partly" | "no";
type Outcome = { result: Result; minutesSaved: number; createdAt: string };
const KEY = "contextbridge_handoff_outcomes_v1";
const OPTIONS: [Result, string][] = [["yes", "Yes, it continued fine"], ["partly", "Partly"], ["no", "No"]];

export default function FeedbackPanel() {
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [minutesSaved, setMinutesSaved] = useState(5);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    try { const parsed = JSON.parse(localStorage.getItem(KEY) || "[]"); if (Array.isArray(parsed)) setOutcomes(parsed.slice(-100)); } catch {}
    const clear = () => { localStorage.removeItem(KEY); setOutcomes([]); setMessage(""); };
    window.addEventListener("contextbridge-clear-all", clear);
    return () => window.removeEventListener("contextbridge-clear-all", clear);
  }, []);

  async function record(result: Result) {
    setError("");
    const next = [...outcomes, { result, minutesSaved, createdAt: new Date().toISOString() }].slice(-100);
    setOutcomes(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { setError("Could not save the local outcome log in this browser."); return; }
    try {
      await postJson("/api/feedback", { result });
      setMessage("Recorded locally and sent as an anonymous outcome rating. No project text was sent.");
    } catch {
      setMessage("Recorded locally. Server feedback could not be sent.");
    }
  }

  function exportLog() {
    const blob = new Blob([JSON.stringify({ schema: "contextbridge-handoff-outcomes-v1", outcomes }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "contextbridge-handoff-outcomes.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const successes = outcomes.filter((x) => x.result === "yes").length;
  const avgSaved = outcomes.length ? Math.round(outcomes.reduce((n, x) => n + x.minutesSaved, 0) / outcomes.length) : 0;
  return <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="font-semibold">Did the new AI pick up your project?</h2>
    <p className="mt-1 text-xs text-slate-500">Your rating and estimated time saved are kept in this browser. When you submit a rating, only yes/partly/no is sent to the app server; no project content is included.</p>
    <label className="mt-3 block text-sm">Estimated minutes of re-explaining avoided
      <select value={minutesSaved} onChange={(e) => setMinutesSaved(Number(e.target.value))} className="ml-2 rounded border border-slate-300 p-1.5 text-sm">{[0, 1, 3, 5, 10, 20, 30].map((n) => <option key={n} value={n}>{n} min</option>)}</select>
    </label>
    <div className="mt-3 flex flex-wrap gap-2">{OPTIONS.map(([value, label]) => <button key={value} onClick={() => record(value)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-600">{label}</button>)}</div>
    {message && <p role="status" className="mt-3 text-xs text-slate-600">{message}</p>}
    {error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
    {outcomes.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600"><span>{outcomes.length} handoffs logged · {Math.round(successes / outcomes.length * 100)}% rated successful · {avgSaved} min average self-estimated</span><button onClick={exportLog} className="rounded border border-slate-300 px-2 py-1">Export log</button><button onClick={() => { localStorage.removeItem(KEY); setOutcomes([]); setMessage("Local outcome log cleared."); }} className="rounded border border-slate-300 px-2 py-1">Clear log</button></div>}
    <p className="mt-2 text-[11px] text-slate-500">These are your own estimates, not independently measured productivity or a quality guarantee. Local history stays on this browser.</p>
  </div>;
}
