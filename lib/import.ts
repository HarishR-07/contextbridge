import JSZip from "jszip";
import type { ProjectState } from "./types";
import { normalizeState } from "./normalize";

/** Loads a saved project_state.json, or an exported ContextBridge ZIP that contains one. */
export async function importState(file: Blob): Promise<ProjectState> {
  if (file.size > 50_000_000) throw new Error("This file is too large.");
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf.slice(0, 2));
  let text: string;
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const zip = await JSZip.loadAsync(buf).catch(() => null);
    const entry = zip && Object.values(zip.files).find((e) => !e.dir && /(^|\/)project_state\.json$/.test(e.name));
    if (!entry) throw new Error("No project_state.json found in this ZIP.");
    if ((entry as any)._data?.uncompressedSize > 5_000_000) throw new Error("project_state.json is too large.");
    text = await entry.async("string");
  } else {
    text = new TextDecoder().decode(buf);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("This file is not a valid project_state.json.");
  }
  const s = normalizeState(raw);
  if (!s.project.name && !s.current_task.title && !s.completed_tasks.length && !s.conversation_summary)
    throw new Error("This file does not look like a ContextBridge project state.");
  return s;
}
