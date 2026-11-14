export interface ProjectState {
  project: { name: string; description: string; goal: string };
  architecture: string[];
  decisions: { decision: string; reason: string }[];
  constraints: string[];
  completed_tasks: string[];
  current_task: { title: string; details: string };
  known_issues: string[];
  failed_approaches: string[];
  next_steps: string[];
  important_context: string[];
  files: { path: string; relevance: string }[];
  conversation_summary: string;
  /** Exact quote matching is machine-checked; this does not prove semantic support. */
  evidence: { claim: string; quote: string; verified?: boolean; sourcePart?: number; sourceStart?: number }[];
}

export type TargetAI = "chatgpt" | "claude" | "gemini" | "generic";
