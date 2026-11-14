import type { ProjectState } from "./types";

export type AccountSession = { access_token: string; refresh_token: string; expires_at: number; user_id: string };
export type SavedProject = { id: string; name: string; state: ProjectState; updated_at: string };
export type SavedProjectVersion = { id: string; project_id: string; name: string; state: ProjectState; created_at: string };
const url = () => (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const anon = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
export const isCloudProjectsConfigured = () => !!(url() && anon());
export const SESSION_STORAGE_KEY = "contextbridge_account_session_v1";
export const readAccountSession = (): AccountSession | null => {
  try { const s = JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY) || "null"); return s?.access_token && s?.refresh_token ? s : null; } catch { return null; }
};
export const saveAccountSession = (s: AccountSession | null) => {
  try { if (s) sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(s)); else sessionStorage.removeItem(SESSION_STORAGE_KEY); } catch {}
};
async function jsonRequest(path: string, init: RequestInit = {}) {
  if (!isCloudProjectsConfigured()) throw new Error("Cloud projects are not configured. Add the Supabase URL and anon key to .env.local.");
  const res = await fetch(`${url()}${path}`, { ...init, headers: { apikey: anon(), "Content-Type": "application/json", ...init.headers } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.msg || data.message || data.error_description || data.error || `Request failed (${res.status}).`);
  return data;
}
function sessionFrom(data: any): AccountSession {
  if (!data?.access_token || !data?.refresh_token || !data?.user?.id) throw new Error("Account created. Check your email to verify it, then sign in.");
  return { access_token: data.access_token, refresh_token: data.refresh_token, user_id: data.user.id, expires_at: Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600) };
}
export async function signIn(email: string, password: string) {
  const data = await jsonRequest("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) });
  return sessionFrom(data);
}
export async function signUp(email: string, password: string) {
  const data = await jsonRequest("/auth/v1/signup", { method: "POST", body: JSON.stringify({ email, password }) });
  return sessionFrom(data);
}
export async function signOut(session: AccountSession) {
  await jsonRequest("/auth/v1/logout", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } }).catch(() => {});
  saveAccountSession(null);
}
async function validSession(input: AccountSession): Promise<AccountSession> {
  if (input.expires_at > Date.now() / 1000 + 60) return input;
  const data = await jsonRequest("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: JSON.stringify({ refresh_token: input.refresh_token }) });
  const next = sessionFrom(data); saveAccountSession(next); return next;
}
export async function listSavedProjects(session: AccountSession): Promise<{ session: AccountSession; projects: SavedProject[] }> {
  const s = await validSession(session);
  const data = await jsonRequest("/rest/v1/saved_projects?select=id,name,state,updated_at&order=updated_at.desc", { headers: { Authorization: `Bearer ${s.access_token}` } });
  return { session: s, projects: data };
}
export async function upsertSavedProject(session: AccountSession, name: string, state: ProjectState, id?: string) {
  const s = await validSession(session);
  if (JSON.stringify(state).length > 1_000_000) throw new Error("Project state is too large to save (1 MB limit).");
  const headers = { Authorization: `Bearer ${s.access_token}` };
  let previous: SavedProject | undefined;
  if (id) {
    const current = await jsonRequest(`/rest/v1/saved_projects?select=id,name,state,updated_at&id=eq.${encodeURIComponent(id)}&limit=1`, { headers });
    previous = current[0] as SavedProject | undefined;
    if (!previous) throw new Error("Saved project was not found. Refresh the project list and try again.");
    await createProjectVersion(s, previous.id, previous.name, previous.state);
  }
  const path = id ? `/rest/v1/saved_projects?id=eq.${encodeURIComponent(id)}` : "/rest/v1/saved_projects";
  const method = id ? "PATCH" : "POST";
  const data = await jsonRequest(path, { method, headers: { Authorization: `Bearer ${s.access_token}`, Prefer: "return=representation" }, body: JSON.stringify({ name: name.slice(0, 120), state, user_id: s.user_id, updated_at: new Date().toISOString() }) });
  const project = data[0] as SavedProject | undefined;
  if (!project) throw new Error("The project save returned no record.");
  await createProjectVersion(s, project.id, project.name, project.state);
  return { session: s, project };
}
async function createProjectVersion(session: AccountSession, projectId: string, name: string, state: ProjectState) {
  const s = await validSession(session);
  await jsonRequest("/rest/v1/saved_project_versions", {
    method: "POST",
    headers: { Authorization: `Bearer ${s.access_token}`, Prefer: "return=minimal" },
    body: JSON.stringify({ project_id: projectId, user_id: s.user_id, name: name.slice(0, 120), state, created_at: new Date().toISOString() }),
  });
}
export async function listProjectVersions(session: AccountSession, projectId: string) {
  const s = await validSession(session);
  const data = await jsonRequest(`/rest/v1/saved_project_versions?select=id,project_id,name,state,created_at&project_id=eq.${encodeURIComponent(projectId)}&order=created_at.desc&limit=50`, { headers: { Authorization: `Bearer ${s.access_token}` } });
  return { session: s, versions: data as SavedProjectVersion[] };
}
export async function restoreProjectVersion(session: AccountSession, projectId: string, versionId: string) {
  const s = await validSession(session);
  const headers = { Authorization: `Bearer ${s.access_token}` };
  const rows = await jsonRequest(`/rest/v1/saved_project_versions?select=id,project_id,name,state,created_at&id=eq.${encodeURIComponent(versionId)}&project_id=eq.${encodeURIComponent(projectId)}&limit=1`, { headers });
  const version = rows[0] as SavedProjectVersion | undefined;
  if (!version) throw new Error("That cloud version is no longer available.");
  const projects = await jsonRequest(`/rest/v1/saved_projects?select=id,name,state,updated_at&id=eq.${encodeURIComponent(projectId)}&limit=1`, { headers });
  const current = projects[0] as SavedProject | undefined;
  if (!current) throw new Error("Saved project was not found.");
  await createProjectVersion(s, current.id, current.name, current.state);
  const updated = await jsonRequest(`/rest/v1/saved_projects?id=eq.${encodeURIComponent(projectId)}`, {
    method: "PATCH", headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({ state: version.state, updated_at: new Date().toISOString() }),
  });
  const project = updated[0] as SavedProject | undefined;
  if (!project) throw new Error("Could not restore this cloud version.");
  await createProjectVersion(s, project.id, project.name, project.state);
  return { session: s, project };
}
export async function deleteSavedProject(session: AccountSession, id: string) {
  const s = await validSession(session);
  await jsonRequest(`/rest/v1/saved_projects?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${s.access_token}` } });
  return s;
}
