"use client";

import { useState } from "react";
import { postJson } from "@/lib/client";
import type { ProjectState } from "@/lib/types";
import { readCodebase, type CodeFile } from "@/lib/zipfiles";
import { shrinkReport, type ShrinkMode } from "@/lib/shrink";

interface Props {
  state: ProjectState;
  code: CodeFile[];
  shrink: ShrinkMode;
  onShrink: (m: ShrinkMode) => void;
  onCode: (files: CodeFile[]) => void;
  onRelevant: (files: ProjectState["files"]) => void;
}

export default function CodebaseUpload({ state, code, shrink, onShrink, onCode, onRelevant }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [skipped, setSkipped] = useState(0);
  const [contentPaths, setContentPaths] = useState<string[]>([]);

  function importHints() {
    const paths = new Set(code.map((f) => f.path));
    return code.map((f) => {
      const refs = f.content ? Array.from(f.content.matchAll(/(?:from\s*|import\s*\(|require\s*\()\s*["']([^"']+)["']/g), (m) => m[1]) : [];
      const links = refs.flatMap((ref) => {
        if (!ref.startsWith(".")) return [];
        const base = f.path.split("/").slice(0, -1);
        for (const part of ref.split("/")) { if (!part || part === ".") continue; if (part === "..") base.pop(); else base.push(part); }
        const stem = base.join("/");
        return [stem, ...["ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "go", "rs"].map((ext) => `${stem}.${ext}`), ...["index.ts", "index.tsx", "index.js", "index.jsx"].map((n) => `${stem}/${n}`)].filter((p) => paths.has(p));
      });
      return { path: f.path, size: f.size, imports: [...new Set(links)].slice(0, 30) };
    });
  }

  async function upload(file?: File) {
    if (!file) return;
    setError("");
    try {
      const r = await readCodebase(file);
      if (!r.files.length) throw new Error("No readable source files found in this ZIP.");
      onCode(r.files);
      setContentPaths([]);
      setSkipped(r.skipped);
    } catch (e) {
      setError(e instanceof Error && e.message.startsWith("No readable") ? e.message : "Could not read this file. Upload a .zip archive of your project.");
    }
  }

  async function findRelevant() {
    setBusy(true);
    setError("");
    try {
      const snippets = code.filter((f) => contentPaths.includes(f.path) && f.content != null).slice(0, 20).map((f) => ({ path: f.path, content: f.content!.slice(0, 6000) }));
      const data = await postJson<{ files: ProjectState["files"] }>("/api/relevant", { state, files: importHints(), snippets });
      onRelevant(data.files);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold">Add your codebase (optional)</h2>
      <p className="mt-1 text-xs text-slate-500">
        The ZIP is read in your browser. File names, sizes, best-effort import links, and the current snapshot summary are sent to the selected AI provider to pick relevant files. Source contents stay in this browser unless you explicitly check files below. Common secret files, lockfiles, images and build folders are skipped. Review the file list before exporting.
      </p>
      <input type="file" accept=".zip" aria-label="Upload project ZIP" onChange={(e) => upload(e.target.files?.[0])} className="mt-3 block text-sm" />
      {code.length > 0 && (
        <div className="mt-3 text-sm text-slate-700">
          <p>{code.length} files read{skipped ? `, ${skipped} skipped` : ""}.</p>
          <details className="mt-2 rounded border border-slate-200 p-2">
            <summary className="cursor-pointer text-xs font-medium">Optional: choose source files to send for deeper relevance analysis</summary>
            <p className="my-2 text-xs text-amber-800">Selected file content is sent to the AI provider. Review each file for embedded credentials or private data. At most 20 files and 6,000 characters per file are sent.</p>
            <div className="max-h-44 overflow-auto">{code.filter((f) => f.content != null).map((f) => <label key={f.path} className="flex items-start gap-2 py-0.5 text-xs"><input type="checkbox" checked={contentPaths.includes(f.path)} disabled={!contentPaths.includes(f.path) && contentPaths.length >= 20} onChange={(e) => setContentPaths((p) => e.target.checked ? [...p, f.path] : p.filter((x) => x !== f.path))} /><code className="break-all">{f.path}</code></label>)}</div>
          </details>
          <button onClick={findRelevant} disabled={busy} className="mt-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2">
            {busy ? "Finding files…" : "Find relevant files"}
          </button>
        </div>
      )}
      {state.files.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {state.files.map((f) => (
            <li key={f.path}><code className="rounded bg-slate-100 px-1">{f.path}</code>{f.relevance && <span className="text-slate-600"> {f.relevance}</span>}</li>
          ))}
        </ul>
      )}
      {state.files.length > 0 && code.length > 0 && (() => {
        const r = shrinkReport(code, state.files.map((f) => f.path), shrink);
        return (
          <div className="mt-3 text-sm">
            <label>Shrink code in export{" "}
              <select value={shrink} onChange={(e) => onShrink(e.target.value as ShrinkMode)} className="rounded border border-slate-300 bg-white px-1 py-0.5">
                <option value="full">Full (unchanged)</option>
                <option value="compact">Compact (no comment-only lines)</option>
                <option value="outline">Outline (declarations only)</option>
              </select>
            </label>
            <p className="mt-1 text-xs text-slate-500">Rough token estimate: {r.before.toLocaleString()} → {r.after.toLocaleString()} ({r.saved}% smaller; about 4 chars/token). Compact can alter text inside multi-line strings; Outline drops function bodies. Review before relying on it.</p>
          </div>
        );
      })()}
      {error && <p role="alert" className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
