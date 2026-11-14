import { NextResponse } from "next/server";
import { getProvider } from "@/lib/ai/provider";
import { extractProjectState } from "@/lib/ai/engine";
import { AppError } from "@/lib/errors";
import { guard, readJson } from "@/lib/guard";
import { scrubSecrets } from "@/lib/scrub";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_CHARS = 200_000;

// Privacy: conversation content is never stored or logged.
export async function POST(req: Request) {
  try {
    guard(req);
    const body = await readJson(req);
    const conversation = typeof body?.conversation === "string" ? scrubSecrets(body.conversation.trim()).text : "";
    if (conversation.length < 50)
      throw new AppError(400, "Paste a longer conversation or project description (at least a few sentences).");
    if (conversation.length > MAX_CHARS)
      throw new AppError(413, `Input is too large (limit ${MAX_CHARS.toLocaleString()} characters). Trim it or split it.`);
    const state = await extractProjectState(getProvider(req.headers), conversation);
    return NextResponse.json({ state });
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Unexpected server error. Please try again." }, { status: 500 });
  }
}
