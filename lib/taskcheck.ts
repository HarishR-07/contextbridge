export interface Step {
  title: string;
  replies: number; // size in "large replies" (one long answer or a multi-file change = 1)
  note: string;
}

export type Verdict = "fits" | "tight" | "cutoff";

export interface Evaluation {
  needed: number;
  available: number;
  verdict: Verdict;
  parts: Step[][];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function normalizePlan(raw: unknown): Step[] {
  const steps = (raw as { steps?: unknown } | null)?.steps;
  return (Array.isArray(steps) ? steps : [])
    .slice(0, 25)
    .map((x: any) => ({
      title: typeof x?.title === "string" ? x.title.trim() : "",
      replies: Math.min(10, Math.max(0.25, Number(x?.replies) || 1)),
      note: typeof x?.note === "string" ? x.note.trim() : "",
    }))
    .filter((s) => s.title);
}

/** limitReplies: how many large replies a full limit gives this user. remainingPct: how much of it is left. */
export function evaluate(steps: Step[], limitReplies: number, remainingPct: number): Evaluation {
  const needed = round1(steps.reduce((sum, s) => sum + s.replies, 0));
  const available = round1((limitReplies * remainingPct) / 100);
  const ratio = available > 0 ? needed / available : Infinity;
  const verdict: Verdict = ratio <= 0.6 ? "fits" : ratio <= 1 ? "tight" : "cutoff";
  // Each part uses at most 70% of what is left, so there is room for the wrap-up and surprises.
  const cap = Math.max(available * 0.7, 0.1);
  const parts: Step[][] = [];
  let used = 0;
  for (const s of steps) {
    if (!parts.length || used + s.replies > cap) {
      parts.push([]);
      used = 0;
    }
    parts[parts.length - 1].push(s);
    used += s.replies;
  }
  return { needed, available, verdict, parts };
}

export function partPrompt(task: string, part: Step[], index: number, total: number): string {
  const list = part.map((s, i) => `${i + 1}. ${s.title}`).join("\n");
  return `I'm working on this task in ${total} part${total > 1 ? "s" : ""}:\n\n${task}\n\nDo ONLY part ${index + 1} now:\n${list}\n\nWhen finished (or if you are about to run out of room), stop and give me a short summary: what is done, what changed, and what is left.`;
}
