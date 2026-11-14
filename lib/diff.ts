import type { ProjectState } from "./types";

export interface Change {
  section: string;
  added: string[];
  removed: string[];
}

const sections = (s: ProjectState): Record<string, string[]> => ({
  "Project name": s.project.name ? [s.project.name] : [],
  Description: s.project.description ? [s.project.description] : [],
  Goal: s.project.goal ? [s.project.goal] : [],
  "Current task": [s.current_task.title, s.current_task.details].filter(Boolean),
  Completed: s.completed_tasks,
  "Known issues": s.known_issues,
  "Next steps": s.next_steps,
  "Failed approaches": s.failed_approaches,
  Decisions: s.decisions.map((d) => d.reason ? `${d.decision} — ${d.reason}` : d.decision),
  Constraints: s.constraints,
  Architecture: s.architecture,
  "Important context": s.important_context,
  Files: s.files.map((f) => f.relevance ? `${f.path} — ${f.relevance}` : f.path),
  "Conversation summary": s.conversation_summary ? [s.conversation_summary] : [],
  Evidence: s.evidence.map((e) => `${e.claim}: ${e.quote}`),
});

export function diffStates(before: ProjectState, after: ProjectState): Change[] {
  const a = sections(before);
  const b = sections(after);
  const norm = (x: string) => x.toLowerCase().trim();
  return Object.keys(b)
    .map((section) => {
      const old = new Set(a[section].map(norm));
      const next = new Set(b[section].map(norm));
      return { section, added: b[section].filter((x) => !old.has(norm(x))), removed: a[section].filter((x) => !next.has(norm(x))) };
    })
    .filter((c) => c.added.length || c.removed.length);
}
