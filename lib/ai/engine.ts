import { AppError } from "../errors";
import type { AIProvider } from "./provider";
import type { ProjectState } from "../types";
import { EXTRACT_SYSTEM } from "../prompts";
import { normalizeState, parseJson } from "../normalize";

export async function extractProjectState(provider: AIProvider, conversation: string): Promise<ProjectState> {
  const output = await provider.complete(EXTRACT_SYSTEM, `<conversation>\n${conversation}\n</conversation>`);
  return normalizeState(parseJson(output));
}

import { OPTIMIZE_SYSTEM, RELEVANT_SYSTEM } from "../prompts";

export async function optimizeContext(provider: AIProvider, text: string): Promise<string> {
  const out = (await provider.complete(OPTIMIZE_SYSTEM, `<context>\n${text}\n</context>`, { json: false, maxTokens: 8000 })).trim();
  if (!out) throw new AppError(502, "The AI returned an empty result. Please try again.");
  return out;
}

export async function identifyRelevantFiles(
  provider: AIProvider,
  state: ProjectState,
  files: { path: string; size: number; imports?: string[] }[],
  snippets: { path: string; content: string }[] = [],
): Promise<{ path: string; relevance: string }[]> {
  const brief = JSON.stringify({ project: state.project, current_task: state.current_task, known_issues: state.known_issues, next_steps: state.next_steps });
  const list = files.map((f) => `${f.path} (${f.size} chars)${f.imports?.length ? ` imports: ${f.imports.join(", ")}` : ""}`).join("\n");
  const source = JSON.stringify(snippets);
  const raw = parseJson(await provider.complete(RELEVANT_SYSTEM, `<project>${brief}</project>\n<files>\n${list}\n</files>\n<optional_source_data>\n${source}\n</optional_source_data>`)) as { files?: unknown };
  const known = new Set(files.map((f) => f.path));
  return (Array.isArray(raw.files) ? raw.files : [])
    .map((f: any) => ({ path: typeof f?.path === "string" ? f.path : "", relevance: typeof f?.relevance === "string" ? f.relevance.trim() : "" }))
    .filter((f) => known.has(f.path))
    .slice(0, 15);
}

import { UPDATE_SYSTEM } from "../prompts";

export async function updateProjectState(provider: AIProvider, state: ProjectState, conversation: string): Promise<ProjectState> {
  const user = `<current_state>\n${JSON.stringify(state)}\n</current_state>\n<new_conversation>\n${conversation}\n</new_conversation>`;
  return normalizeState(parseJson(await provider.complete(UPDATE_SYSTEM, user, { maxTokens: 6000 })));
}

import { TASK_SYSTEM } from "../prompts";
import { normalizePlan, type Step } from "../taskcheck";

export async function planTask(provider: AIProvider, task: string): Promise<Step[]> {
  const steps = normalizePlan(parseJson(await provider.complete(TASK_SYSTEM, `<task>\n${task}\n</task>`)));
  if (!steps.length) throw new AppError(502, "Could not break this task into steps. Try describing it in more detail.");
  return steps;
}
