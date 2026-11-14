"use client";

import type { ProjectState } from "@/lib/types";

type ListKey = "architecture" | "constraints" | "completed_tasks" | "known_issues" | "failed_approaches" | "next_steps" | "important_context";
const LISTS: [ListKey, string][] = [
  ["architecture", "Architecture"], ["constraints", "Constraints"], ["completed_tasks", "Completed tasks"],
  ["known_issues", "Known issues"], ["failed_approaches", "Failed approaches"], ["next_steps", "Next steps"], ["important_context", "Important context"],
];
const area = "mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm";

export default function SnapshotEditor({ state, onChange }: { state: ProjectState; onChange: (s: ProjectState) => void }) {
  function list(key: ListKey, value: string) {
    onChange({ ...state, [key]: value.split("\n").map((x) => x.trim()).filter(Boolean) });
  }
  return <details className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <summary className="cursor-pointer font-semibold">Review and edit snapshot</summary>
    <p className="mt-2 text-xs text-slate-500">Correct extraction errors before handoff. One item per line. Edits are in memory until you save a version or export.</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="text-sm">Project name<input className={area} value={state.project.name} onChange={(e) => onChange({ ...state, project: { ...state.project, name: e.target.value } })} /></label>
      <label className="text-sm">Goal<input className={area} value={state.project.goal} onChange={(e) => onChange({ ...state, project: { ...state.project, goal: e.target.value } })} /></label>
      <label className="text-sm sm:col-span-2">Description<textarea className={area} rows={2} value={state.project.description} onChange={(e) => onChange({ ...state, project: { ...state.project, description: e.target.value } })} /></label>
      <label className="text-sm">Current task<input className={area} value={state.current_task.title} onChange={(e) => onChange({ ...state, current_task: { ...state.current_task, title: e.target.value } })} /></label>
      <label className="text-sm">Task details<textarea className={area} rows={2} value={state.current_task.details} onChange={(e) => onChange({ ...state, current_task: { ...state.current_task, details: e.target.value } })} /></label>
      {LISTS.map(([key, title]) => <label key={key} className="text-sm">{title}<textarea className={area} rows={3} value={state[key].join("\n")} onChange={(e) => list(key, e.target.value)} /></label>)}
      <label className="text-sm">Decisions <span className="text-xs text-slate-500">One per line; separate reason with |</span><textarea className={area} rows={3} value={state.decisions.map((d) => d.reason ? `${d.decision} | ${d.reason}` : d.decision).join("\n")} onChange={(e) => onChange({ ...state, decisions: e.target.value.split("\n").map((line) => { const i = line.indexOf("|"); return { decision: (i < 0 ? line : line.slice(0, i)).trim(), reason: i < 0 ? "" : line.slice(i + 1).trim() }; }).filter((d) => d.decision) })} /></label>
      <label className="text-sm">Relevant files <span className="text-xs text-slate-500">One path per line; optional relevance after |</span><textarea className={area} rows={3} value={state.files.map((f) => f.relevance ? `${f.path} | ${f.relevance}` : f.path).join("\n")} onChange={(e) => onChange({ ...state, files: e.target.value.split("\n").map((line) => { const i = line.indexOf("|"); return { path: (i < 0 ? line : line.slice(0, i)).trim(), relevance: i < 0 ? "" : line.slice(i + 1).trim() }; }).filter((f) => f.path) })} /></label>
      <label className="text-sm sm:col-span-2">Conversation summary<textarea className={area} rows={4} value={state.conversation_summary} onChange={(e) => onChange({ ...state, conversation_summary: e.target.value })} /></label>
      <label className="text-sm sm:col-span-2">Supporting excerpts <span className="text-xs text-slate-500">One claim | exact quote per line</span><textarea className={area} rows={4} value={state.evidence.map((e) => `${e.claim} | ${e.quote}`).join("\n")} onChange={(e) => onChange({ ...state, evidence: e.target.value.split("\n").map((line) => { const i = line.indexOf("|"); return { claim: (i < 0 ? line : line.slice(0, i)).trim(), quote: i < 0 ? "" : line.slice(i + 1).trim() }; }).filter((x) => x.claim && x.quote).slice(0, 30) })} /></label>
    </div>
  </details>;
}
