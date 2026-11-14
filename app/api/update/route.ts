import { NextResponse } from "next/server";
import { getProvider } from "@/lib/ai/provider";
import { updateProjectState } from "@/lib/ai/engine";
import { normalizeState } from "@/lib/normalize";
import { scrubSecrets } from "@/lib/scrub";
import { guard, readJson } from "@/lib/guard";
import { AppError } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_CHARS = 150_000;

// Privacy: content is never stored or logged.
export async function POST(req: Request) {
  try {
    guard(req);
    const body = await readJson(req);
    const state = normalizeState(body?.state);
    if (!state.project.name && !state.current_task.title && !state.completed_tasks.length && !state.conversation_summary)
      throw new AppError(400, "Create or import a snapshot first.");
    const conversation = typeof body?.conversation === "string" ? scrubSecrets(body.conversation.trim()).text : "";
    if (conversation.length < 50) throw new AppError(400, "Paste the new part of the conversation (at least a few sentences).");
    if (conversation.length > MAX_CHARS) throw new AppError(413, `Input is too large (limit ${MAX_CHARS.toLocaleString()} characters).`);
    return NextResponse.json({ state: await updateProjectState(getProvider(req.headers), state, conversation) });
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Unexpected server error. Please try again." }, { status: 500 });
  }
}
