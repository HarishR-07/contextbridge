import JSZip from "jszip";
import type { ProjectState, TargetAI } from "./types";
import { buildContinuationPrompt } from "./continuation";
import { buildCheck, checkPrompt } from "./check";
import { isSafePath, type CodeFile } from "./zipfiles";
import { shrinkFile, type ShrinkMode } from "./shrink";

const L = (items: string[]) => (items.length ? items.map((i) => `- ${i}`).join("\n") : "_None recorded._");

export function stateToFiles(s: ProjectState, target: TargetAI): Record<string, string> {
  const decisions = s.decisions.map((d) => (d.reason ? `**${d.decision}**: ${d.reason}` : d.decision));
  const task = s.current_task.title ? `**${s.current_task.title}**\n\n${s.current_task.details}` : "_Not specified._";
  return {
    "PROJECT_SUMMARY.md": `# ${s.project.name || "Untitled project"}\n\n${s.project.description}\n\n**Goal:** ${s.project.goal || "Not specified"}\n`,
    "CURRENT_STATE.md": `# Current state\n\n## Current task\n${task}\n\n## Known issues\n${L(s.known_issues)}\n`,
    "ARCHITECTURE.md": `# Architecture\n\n${L(s.architecture)}\n`,
    "DECISIONS.md": `# Decisions\n\n${L(decisions)}\n`,
    "TASK_STATUS.md": `# Task status\n\n## Completed\n${L(s.completed_tasks)}\n\n## In progress\n${task}\n`,
    "KNOWN_ISSUES.md": `# Known issues\n\n${L(s.known_issues)}\n\n## Failed approaches\n${L(s.failed_approaches)}\n`,
    "NEXT_STEPS.md": `# Next steps\n\n${L(s.next_steps)}\n`,
    "IMPORTANT_CONTEXT.md": `# Important context\n\n## Constraints\n${L(s.constraints)}\n\n## Other\n${L(s.important_context)}\n`,
    "CONVERSATION_SUMMARY.md": `# Conversation summary\n\n${s.conversation_summary || "_None recorded._"}\n`,
    "EVIDENCE.md": `# Evidence and source checks\n\nA quote marked as found was matched exactly (ignoring case and whitespace) against the source part shown below. This proves the text occurs in the supplied source, not that it supports the claim's interpretation.\n\n${s.evidence.length ? s.evidence.map((e) => `- **${e.verified ? "Quote found" : "Quote not found"}${e.sourcePart ? ` · part ${e.sourcePart}` : ""}** — ${e.claim}: “${e.quote}”`).join("\n") : "_No supporting excerpts recorded._"}\n`,
    "FILE_MANIFEST.json": JSON.stringify(s.files, null, 2),
    "project_state.json": JSON.stringify(s, null, 2),
    "HANDOFF_CHECK.md": `# Handoff check\n\nSend after the continuation prompt, then compare answers.\n\n${checkPrompt(buildCheck(s))}\n\n## Expected answers\n${buildCheck(s).map((i, n) => `${n + 1}. ${i.a}`).join("\n") || "_None._"}\n`,
    "CONTINUATION_PROMPT.md": buildContinuationPrompt(s, target) + "\n",
    "CLAUDE.md": `# Project handoff\n\n${buildContinuationPrompt(s, "claude")}\n`,
    "AGENTS.md": `# Project handoff\n\n${buildContinuationPrompt(s, "generic")}\n`,
    ".cursorrules": `# Project handoff\n\n${buildContinuationPrompt(s, "generic")}\n`,
  };
}

export async function downloadZip(s: ProjectState, target: TargetAI, code: CodeFile[] = [], mode: ShrinkMode = "full"): Promise<void> {
  const zip = new JSZip();
  const folder = zip.folder("PROJECT_STATE")!;
  for (const [name, content] of Object.entries(stateToFiles(s, target))) folder.file(name, content);
  const byPath = new Map(code.map((c) => [c.path, c]));
  for (const f of s.files) {
    const c = byPath.get(f.path);
    if (c?.content != null && isSafePath(c.path)) folder.file(`project-files/${c.path}`, shrinkFile(c.path, c.content, mode));
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const slug = (s.project.name || "project").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug}-project-state.zip`;
  a.click();
  // Allow the browser to begin consuming the download before releasing the URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
