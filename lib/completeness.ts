import type { ProjectState } from "./types";

/** Share of the key sections that are filled in. It measures the snapshot, not the project's health. */
export function completeness(s: ProjectState): { percent: number; missing: string[] } {
  const checks: [string, boolean][] = [
    ["project name", !!s.project.name], ["goal", !!s.project.goal], ["architecture", s.architecture.length > 0],
    ["decisions", s.decisions.length > 0], ["constraints", s.constraints.length > 0], ["current task", !!s.current_task.title],
    ["next steps", s.next_steps.length > 0], ["summary", !!s.conversation_summary],
  ];
  return { percent: Math.round((checks.filter((c) => c[1]).length / checks.length) * 100), missing: checks.filter((c) => !c[1]).map((c) => c[0]) };
}
