import { NextResponse } from "next/server";
import { guard, readJson } from "@/lib/guard";
import { AppError } from "@/lib/errors";

export const runtime = "nodejs";

// Records only the answer (yes/partly/no). No project content is received.
export async function POST(req: Request) {
  try {
    guard(req);
    const body = await readJson(req);
    const result = body?.result;
    if (!["yes", "partly", "no"].includes(result)) throw new AppError(400, "Invalid feedback.");
    const hook = process.env.FEEDBACK_WEBHOOK_URL;
    if (hook?.startsWith("https://")) {
      await fetch(hook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ result, at: new Date().toISOString() }), signal: AbortSignal.timeout(5000) }).catch(() => {});
    }
    console.log(`feedback:${result}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
