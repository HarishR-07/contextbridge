"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProjectState } from "@/lib/types";
import { diffStates } from "@/lib/diff";
import { deleteSavedProject, isCloudProjectsConfigured, listProjectVersions, listSavedProjects, readAccountSession, restoreProjectVersion, saveAccountSession, signIn, signOut, signUp, upsertSavedProject, type AccountSession, type SavedProject, type SavedProjectVersion } from "@/lib/savedProjects";

export default function CloudProjects({ state, onLoad }: { state: ProjectState; onLoad: (s: ProjectState) => void }) {
  const [session, setSession] = useState<AccountSession | null>(null);
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [selected, setSelected] = useState("");
  const [versions, setVersions] = useState<SavedProjectVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [search, setSearch] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState(state.project.name || "Untitled project");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const configured = isCloudProjectsConfigured();
  const visibleProjects = useMemo(() => projects.filter((p) => p.name.toLocaleLowerCase().includes(search.toLocaleLowerCase().trim())), [projects, search]);
  const version = versions.find((v) => v.id === selectedVersion);
  const versionDiff = version ? diffStates(version.state, state) : [];
  useEffect(() => { const s = readAccountSession(); if (s) { setSession(s); void refresh(s); } }, []);

  async function refresh(s: AccountSession): Promise<AccountSession> {
    try { const r = await listSavedProjects(s); setSession(r.session); saveAccountSession(r.session); setProjects(r.projects); return r.session; }
    catch (e) { setMessage(e instanceof Error ? e.message : "Could not load cloud projects."); return s; }
  }
  async function loadVersions(s: AccountSession, projectId: string) {
    try { const r = await listProjectVersions(s, projectId); setSession(r.session); saveAccountSession(r.session); setVersions(r.versions); setSelectedVersion(""); }
    catch (e) { setVersions([]); setMessage(e instanceof Error ? e.message : "Could not load cloud versions."); }
  }
  async function authenticate() {
    setBusy(true); setMessage("");
    try { const s = mode === "login" ? await signIn(email, password) : await signUp(email, password); setSession(s); saveAccountSession(s); await refresh(s); setPassword(""); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Account request failed."); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!session) return;
    setBusy(true); setMessage("");
    try {
      const r = await upsertSavedProject(session, name.trim() || "Untitled project", state, selected || undefined);
      setSession(r.session); saveAccountSession(r.session); setSelected(r.project.id);
      const s = await refresh(r.session); await loadVersions(s, r.project.id);
      setMessage("Saved. Current and previous states are in cloud version history.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not save project."); }
    finally { setBusy(false); }
  }
  async function selectProject(id: string) {
    setSelected(id); setVersions([]); setSelectedVersion("");
    const p = projects.find((x) => x.id === id);
    if (!p) return;
    setName(p.name); onLoad(p.state);
    if (session) await loadVersions(session, id);
  }
  async function restoreVersion() {
    if (!session || !selected || !selectedVersion) return;
    setBusy(true); setMessage("");
    try {
      const r = await restoreProjectVersion(session, selected, selectedVersion);
      onLoad(r.project.state); setSession(r.session); saveAccountSession(r.session);
      const s = await refresh(r.session); await loadVersions(s, selected);
      setMessage("Cloud version restored. The state replaced by this restore was also versioned.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not restore this version."); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!session || !selected) return;
    setBusy(true); try { const s = await deleteSavedProject(session, selected); setSession(s); await refresh(s); setSelected(""); setVersions([]); setSelectedVersion(""); setMessage("Cloud project and its version history deleted."); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Could not delete project."); } finally { setBusy(false); }
  }

  return <details className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <summary className="cursor-pointer font-semibold">Account and cloud projects</summary>
    {!configured ? <p className="mt-2 text-sm text-slate-600">Configure the Supabase URL and public anon key, then run <code>supabase/schema.sql</code> to enable accounts, private cloud saves and cloud version history.</p> : !session ? <div className="mt-3 grid gap-2 sm:grid-cols-2">
      <label className="text-sm">Email<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded border p-2" /></label>
      <label className="text-sm">Password<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded border p-2" /></label>
      <div className="flex gap-2"><button disabled={busy || !email || password.length < 8} onClick={authenticate} className="rounded bg-teal-700 px-3 py-2 text-sm text-white disabled:opacity-50">{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button><button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="text-sm underline">Switch to {mode === "login" ? "sign up" : "sign in"}</button></div>
    </div> : <div className="mt-3 space-y-2">
      <p className="text-xs text-slate-600">Signed in. Cloud projects and their saved versions are private to your account through database row-level security.</p>
      <div className="flex flex-wrap gap-2"><input aria-label="Cloud project name" value={name} onChange={(e) => setName(e.target.value)} className="rounded border p-2 text-sm" /><button disabled={busy} onClick={save} className="rounded bg-teal-700 px-3 py-2 text-sm text-white disabled:opacity-50">{selected ? "Save new version" : "Save new project"}</button><button onClick={async () => { await signOut(session); setSession(null); setProjects([]); setVersions([]); setSelected(""); }} className="rounded border px-3 py-2 text-sm">Sign out</button></div>
      {projects.length > 0 && <div className="grid gap-2 sm:grid-cols-2"><label className="text-sm">Search saved projects<input aria-label="Search saved cloud projects" value={search} onChange={(e) => setSearch(e.target.value)} className="mt-1 w-full rounded border p-2 text-sm" /></label><label className="text-sm">Saved projects<select aria-label="Saved cloud project" value={selected} onChange={(e) => { void selectProject(e.target.value); }} className="mt-1 w-full rounded border p-2 text-sm"><option value="">Choose saved project</option>{visibleProjects.map((p) => <option key={p.id} value={p.id}>{p.name} · {new Date(p.updated_at).toLocaleString()}</option>)}</select></label><button disabled={!selected || busy} onClick={remove} className="w-fit rounded border px-3 py-1.5 text-sm disabled:opacity-40">Delete project and versions</button></div>}
      {selected && <div className="rounded-lg border border-slate-200 p-3"><h3 className="text-sm font-semibold">Cloud version history</h3><p className="mt-1 text-xs text-slate-500">Each save keeps the state before and after the update. The 50 most recent versions are listed here.</p>{versions.length ? <div className="mt-2 flex flex-wrap items-end gap-2"><label className="min-w-64 flex-1 text-sm">Choose version<select value={selectedVersion} onChange={(e) => setSelectedVersion(e.target.value)} className="mt-1 w-full rounded border p-2 text-sm"><option value="">Choose a version</option>{versions.map((v) => <option key={v.id} value={v.id}>{new Date(v.created_at).toLocaleString()} · {v.name}</option>)}</select></label><button disabled={!version || busy} onClick={restoreVersion} className="rounded border px-3 py-2 text-sm disabled:opacity-40">Restore selected version</button></div> : <p className="mt-2 text-xs text-slate-500">No saved versions yet. Save this project to begin version history.</p>}{version && <div className="mt-2 text-xs text-slate-600">Current state differs from this version in {versionDiff.length} section(s): {versionDiff.map((d) => d.section).join(", ") || "no differences"}.</div>}</div>}
    </div>}
    {message && <p role="status" className="mt-2 text-xs text-slate-600">{message}</p>}
    {configured && <p className="mt-2 text-xs text-amber-800">Cloud saves contain project state and may contain sensitive details. Use only a trusted deployment and account. Delete the project to delete its cloud history.</p>}
  </details>;
}
