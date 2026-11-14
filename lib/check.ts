import type { ProjectState } from "./types";

export interface CheckItem {
  q: string;
  a: string;
}

/** Questions the receiving AI should answer correctly after reading the continuation prompt. */
export function buildCheck(s: ProjectState): CheckItem[] {
  const items: CheckItem[] = [
    { q: "What is this project and what is its goal?", a: [s.project.name, s.project.description, s.project.goal].filter(Boolean).join(". ") },
    { q: "What is the current task?", a: [s.current_task.title, s.current_task.details].filter(Boolean).join(": ") },
    { q: "What should be done first?", a: s.next_steps[0] ?? "" },
    { q: "Which approaches already failed and must not be repeated?", a: s.failed_approaches.join("; ") },
    { q: "Which constraints must be respected?", a: s.constraints.join("; ") },
    { q: "Which key decisions were made, and why?", a: s.decisions.map((d) => (d.reason ? `${d.decision} (${d.reason})` : d.decision)).join("; ") },
  ];
  return items.filter((i) => i.a);
}

export function checkPrompt(items: CheckItem[]): string {
  return `Before continuing, answer these questions using only the project context above. If something is not in the context, say so instead of guessing.\n\n${items.map((i, n) => `${n + 1}. ${i.q}`).join("\n")}`;
}
