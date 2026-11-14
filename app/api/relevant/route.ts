import { NextResponse } from "next/server";
import { getProvider } from "@/lib/ai/provider";
import { identifyRelevantFiles } from "@/lib/ai/engine";
import { normalizeState } from "@/lib/normalize";
import { AppError } from "@/lib/errors";
import { guard, readJson } from "@/lib/guard";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_FILES = 2000;

// Metadata/import links are always received. Source excerpts arrive only after explicit user selection.
export async function POST(req: Request) {
  try {
    guard(req);
    const body = await readJson(req);
    const files = (Array.isArray(body?.files) ? body.files : [])
      .filter((f: any) => typeof f?.path === "string" && f.path.length < 300 && typeof f?.size === "number")
      .map((f: any) => ({ path: f.path, size: f.size, imports: Array.isArray(f.imports) ? f.imports.filter((p: any) => typeof p === "string" && p.length < 300).slice(0, 30) : [] }))
      .slice(0, MAX_FILES) as { path: string; size: number }[];
    if (!files.length) throw new AppError(400, "No files provided.");
    const known = new Set(files.map((f) => f.path));
    const snippets: { path: string; content: string }[] = [];
    let snippetChars = 0;
    for (const s of Array.isArray(body?.snippets) ? body.snippets : []) {
      if (typeof s?.path !== "string" || !known.has(s.path) || typeof s?.content !== "string" || snippets.length >= 20 || snippetChars >= 60_000) continue;
      const content = s.content.slice(0, Math.min(6_000, 60_000 - snippetChars));
      snippets.push({ path: s.path, content }); snippetChars += content.length;
    }
    const relevant = await identifyRelevantFiles(getProvider(req.headers), normalizeState(body?.state), files, snippets);
    return NextResponse.json({ files: relevant });
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Unexpected server error. Please try again." }, { status: 500 });
  }
}
