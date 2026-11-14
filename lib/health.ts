import type { ProjectState } from "./types";

export interface Factor { name: string; points: number; max: number; note: string }
export interface Health { score: number; band: "Healthy" | "Needs attention" | "At risk"; factors: Factor[]; tip: string }

const missing = (pairs: [string, boolean][]) => pairs.filter((p) => !p[1]).map((p) => p[0]);

/** Scores how ready the snapshot is to continue the work. It says nothing about code quality. */
export function computeHealth(s: ProjectState, promptTokens: number, budget: number): Health {
  const c = missing([["goal", !!s.project.goal], ["current task", !!s.current_task.title], ["next steps", s.next_steps.length > 0]]);
  const k = missing([["architecture", s.architecture.length > 0], ["decisions", s.decisions.length > 0], ["constraints", s.constraints.length > 0]]);
  const open = s.next_steps.length + s.known_issues.length;
  const total = s.completed_tasks.length + open;
  const ratio = budget > 0 ? promptTokens / budget : 1;
  const factors: Factor[] = [
    { name: "Clarity", max: 25, points: Math.max(0, 25 - c.length * 8), note: c.length ? `Missing: ${c.join(", ")}` : "Goal, task and next steps are clear" },
    { name: "Knowledge", max: 25, points: Math.max(0, 25 - k.length * 8), note: k.length ? `Missing: ${k.join(", ")}` : "Architecture, decisions and constraints captured" },
    { name: "Progress", max: 20, points: total ? Math.round((20 * s.completed_tasks.length) / total) : 0, note: total ? `${s.completed_tasks.length} done, ${open} open` : "No tasks recorded" },
    { name: "Open issues", max: 15, points: Math.max(0, 15 - s.known_issues.length * 3), note: s.known_issues.length ? `${s.known_issues.length} known issue(s)` : "No known issues" },
    { name: "Context size", max: 15, points: ratio <= 0.5 ? 15 : ratio <= 1 ? Math.round(30 * (1 - ratio)) : 0, note: ratio > 1 ? "Prompt is over your budget: optimize it" : `${Math.round(ratio * 100)}% of your budget` },
  ];
  const score = Math.min(100, factors.reduce((n, f) => n + f.points, 0));
  const worst = [...factors].sort((a, b) => b.max - b.points - (a.max - a.points))[0];
  return {
    score,
    band: score >= 80 ? "Healthy" : score >= 55 ? "Needs attention" : "At risk",
    factors,
    tip: worst.max - worst.points > 0 ? `Biggest gain: ${worst.name.toLowerCase()}. ${worst.note}.` : "Nothing to fix. This snapshot is ready to hand off.",
  };
}
