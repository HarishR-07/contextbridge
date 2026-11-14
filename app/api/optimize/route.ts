import { NextResponse } from "next/server";
import { getProvider } from "@/lib/ai/provider";
import { optimizeContext } from "@/lib/ai/engine";
import { buildReport, dedupeParagraphs } from "@/lib/optimize";
import { AppError } from "@/lib/errors";
import { guard, readJson } from "@/lib/guard";
import { scrubSecrets } from "@/lib/scrub";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_CHARS = 200_000;

// Privacy: content is never stored or logged.
export async function POST(req: Request) {
  try {
    guard(req);
    const body = await readJson(req);
    const text = typeof body?.text === "string" ? scrubSecrets(body.text.trim()).text : "";
    if (text.length < 200) throw new AppError(400, "Paste more context to optimize (at least a few paragraphs).");
    if (text.length > MAX_CHARS) throw new AppError(413, `Input is too large (limit ${MAX_CHARS.toLocaleString()} characters).`);
    const deduped = dedupeParagraphs(text);
    const optimized = await optimizeContext(getProvider(req.headers), deduped.text);
    return NextResponse.json({ optimized, report: buildReport(text, deduped.removedChars, optimized) });
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Unexpected server error. Please try again." }, { status: 500 });
  }
}
