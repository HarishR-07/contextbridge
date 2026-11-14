"use client";

import { useMemo, useState } from "react";
import { postJson } from "@/lib/client";
import { scrubSecrets } from "@/lib/scrub";
import { evaluate, partPrompt, type Step, type Verdict } from "@/lib/taskcheck";

const VERDICT: Record<Verdict, { label: string; style: string }> = {
  fits: { label: "Likely to finish in one go", style: "bg-emerald-50 text-emerald-800" },
  tight: { label: "Tight: may be cut off near the end", style: "bg-amber-50 text-amber-800" },
  cutoff: { label: "Unlikely to finish before the limit", style: "bg-red-50 text-red-700" },
};

export default function TaskCheck() {
  const [task, setTask] = useState("");
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [limit, setLimit] = useState(20);
  const [remaining, setRemaining] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(-1);

  const result = useMemo(() => (steps ? evaluate(steps, limit, remaining) : null), [steps, limit, remaining]);

  async function run() {
    setLoading(true);
    setError("");
    try {
      const data = await postJson<{ steps: Step[] }>("/api/task", { task: scrubSecrets(task).text });
      setSteps(data.steps);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function copy(text: string, n: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(n);
      setTimeout(() => setCopied(-1), 1500);
    } catch {
      setError("Copy failed. Select the text and copy it manually.");
    }
  }

  const field = "mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600";
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label htmlFor="task" className="font-semibold">What do you want the AI to do?</label>
        <textarea id="task" value={task} onChange={(e) => setTask(e.target.value)} rows={5} placeholder="Describe the big task you are about to send…" className={`${field} p-3`} />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Large replies you get from one full limit
            <input type="number" min={1} max={500} value={limit} onChange={(e) => setLimit(Math.min(500, Math.max(1, Number(e.target.value) || 1)))} className={field} />
            <span className="text-xs text-slate-500">Your own experience: how many long answers before you hit the limit?</span>
          </label>
          <label className="text-sm">
            How much of today&apos;s limit is left?
            <select value={remaining} onChange={(e) => setRemaining(Number(e.target.value))} className={field}>
              {[100, 75, 50, 25, 10].map((v) => <option key={v} value={v}>{v === 100 ? "All of it" : `About ${v}%`}</option>)}
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-500">An estimate only. AI providers don&apos;t publish exact limits, so the verdict is as good as your two numbers above. The task text is sent once to the AI provider and not stored.</p>
        <div className="mt-3 flex justify-end">
          <button onClick={run} disabled={loading || task.trim().length < 20} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2">
            {loading ? "Checking…" : "Check task"}
          </button>
        </div>
        {error && <p role="alert" className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </section>

      {steps && result && (
        <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className={`rounded-lg p-3 text-sm font-semibold ${VERDICT[result.verdict].style}`}>
            {VERDICT[result.verdict].label}
            <div className="mt-0.5 font-normal">Needs about {result.needed} large replies; you have about {result.available}.</div>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Estimated steps</h3>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm text-slate-700">
              {steps.map((s, i) => <li key={i}>{s.title} <span className="text-slate-400">({s.replies})</span>{s.note && <span className="text-slate-500">: {s.note}</span>}</li>)}
            </ol>
          </div>
          {result.parts.length > 1 && (
            <div>
              <h3 className="text-sm font-semibold">Split it so nothing is lost mid-way</h3>
              <p className="text-xs text-slate-500">Run one part at a time. After each, save a snapshot, so you can continue in a new chat or another AI if the limit hits.</p>
              {result.parts.map((part, n) => (
                <div key={n} className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
                  <div className="font-medium">Part {n + 1} of {result.parts.length}</div>
                  <ul className="mt-1 list-disc pl-5 text-slate-700">{part.map((s, i) => <li key={i}>{s.title}</li>)}</ul>
                  <button onClick={() => copy(partPrompt(task, part, n, result.parts.length), n)} className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600">
                    {copied === n ? "Copied" : `Copy Part ${n + 1} prompt`}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
