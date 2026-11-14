"use client";

import { useState } from "react";
import type { ProjectState } from "@/lib/types";
import { computeHealth } from "@/lib/health";
import type { TokenModel } from "@/lib/tokens";

const BAND = { Healthy: "text-emerald-700", "Needs attention": "text-amber-700", "At risk": "text-red-700" } as const;

export default function HealthCard({ state, promptTokens, tokenModel }: { state: ProjectState; promptTokens: number; tokenModel: TokenModel }) {
  const [budget, setBudget] = useState(16000);
  const h = computeHealth(state, promptTokens, budget);
  return (
    <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm">
      <div className="flex items-baseline justify-between">
        <span className="font-semibold">Project health</span>
        <span className={`font-semibold ${BAND[h.band]}`}>{h.score}% · {h.band}</span>
      </div>
      <progress value={h.score} max={100} aria-label="Project health" className="mt-1 h-2 w-full" />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <span>Context: {promptTokens.toLocaleString()} / {budget.toLocaleString()} tokens ({tokenModel === "claude-sonnet" || tokenModel === "gemini-2.5" ? "rough" : "tokenizer"})</span>
        <label>Budget{" "}
          <select value={budget} onChange={(e) => setBudget(Number(e.target.value))} className="rounded border border-slate-300 bg-white px-1 py-0.5">
            {[8000, 16000, 32000, 100000].map((b) => <option key={b} value={b}>{b.toLocaleString()}</option>)}
          </select>
        </label>
      </div>
      <ul className="mt-3 space-y-0.5 text-xs text-slate-700">
        {h.factors.map((f) => <li key={f.name}><span className="font-medium">{f.name}</span> {f.points}/{f.max}: <span className="text-slate-500">{f.note}</span></li>)}
      </ul>
      <p className="mt-2 text-xs text-slate-600">{h.tip}</p>
      <p className="mt-2 text-xs text-slate-400">Based on the snapshot, not a measure of code quality.</p>
    </div>
  );
}
