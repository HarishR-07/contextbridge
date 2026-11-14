import { NextResponse } from "next/server";
import { getProvider } from "@/lib/ai/provider";
import { planTask } from "@/lib/ai/engine";
import { scrubSecrets } from "@/lib/scrub";
import { guard, readJson } from "@/lib/guard";
import { AppError } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_CHARS = 20_000;

// Privacy: the task text is never stored or logged.
export async function POST(req: Request) {
  try {
    guard(req);
    const body = await readJson(req);
    const task = typeof body?.task === "string" ? scrubSecrets(body.task.trim()).text : "";
    if (task.length < 20) throw new AppError(400, "Describe the task in a bit more detail.");
    if (task.length > MAX_CHARS) throw new AppError(413, `Task is too long (limit ${MAX_CHARS.toLocaleString()} characters).`);
    return NextResponse.json({ steps: await planTask(getProvider(req.headers), task) });
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Unexpected server error. Please try again." }, { status: 500 });
  }
}
