import type { ProjectState } from "./types";
import { AppError } from "./errors";

const s = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strings = (v: unknown): string[] => list(v).map(s).filter(Boolean);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

export function parseJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new AppError(502, "The AI returned an unreadable response. Please try again.");
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new AppError(502, "The AI returned an unreadable response. Please try again.");
  }
}

/** Coerces untrusted AI output into a complete, safe ProjectState. */
export function normalizeState(raw: unknown): ProjectState {
  const r = obj(raw);
  const project = obj(r.project);
  const task = obj(r.current_task);
  return {
    project: { name: s(project.name), description: s(project.description), goal: s(project.goal) },
    architecture: strings(r.architecture),
    decisions: list(r.decisions)
      .map((d) => (typeof d === "string" ? { decision: s(d), reason: "" } : { decision: s(obj(d).decision), reason: s(obj(d).reason) }))
      .filter((d) => d.decision),
    constraints: strings(r.constraints),
    completed_tasks: strings(r.completed_tasks),
    current_task: { title: s(task.title), details: s(task.details) },
    known_issues: strings(r.known_issues),
    failed_approaches: strings(r.failed_approaches),
    next_steps: strings(r.next_steps),
    important_context: strings(r.important_context),
    files: list(r.files)
      .map((f) => (typeof f === "string" ? { path: s(f), relevance: "" } : { path: s(obj(f).path), relevance: s(obj(f).relevance) }))
      .filter((f) => f.path),
    conversation_summary: s(r.conversation_summary),
    evidence: list(r.evidence).map((e) => ({ claim: s(obj(e).claim), quote: s(obj(e).quote), verified: typeof obj(e).verified === "boolean" ? obj(e).verified as boolean : undefined, sourcePart: Number.isInteger(obj(e).sourcePart) ? obj(e).sourcePart as number : undefined, sourceStart: Number.isInteger(obj(e).sourceStart) ? obj(e).sourceStart as number : undefined })).filter((e) => e.claim && e.quote).slice(0, 30),
  };
}
