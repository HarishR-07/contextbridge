#!/usr/bin/env node
// Minimal MCP stdio server. It only accesses .contextbridge/project_state.json under its cwd.
import { createInterface } from "node:readline";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dir = path.join(root, ".contextbridge");
const stateFile = path.join(dir, "project_state.json");
const protocolVersion = "2024-11-05";
const send = (message) => process.stdout.write(JSON.stringify(message) + "\n");
function validState(s) {
  return s && typeof s === "object" && s.project && typeof s.project === "object" && s.current_task && typeof s.current_task === "object";
}
async function readState() {
  const raw = await readFile(stateFile, "utf8");
  if (Buffer.byteLength(raw) > 1_000_000) throw new Error("Project state exceeds 1 MB.");
  const state = JSON.parse(raw);
  if (!validState(state)) throw new Error("State file is not a ContextBridge project state.");
  return state;
}
const tools = [
  { name: "read_project_state", description: "Read the ContextBridge project snapshot saved in .contextbridge/project_state.json under the configured workspace.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "update_project_state", description: "Replace the ContextBridge snapshot with a corrected full state object. The previous file is kept as a timestamped backup.", inputSchema: { type: "object", properties: { state: { type: "object", description: "Complete ProjectState object" } }, required: ["state"], additionalProperties: false } },
];

async function handle(m) {
  if (m.method === "notifications/initialized" || m.method === "notifications/cancelled") return;
  if (m.method === "initialize") return send({ jsonrpc: "2.0", id: m.id, result: { protocolVersion, capabilities: { tools: {} }, serverInfo: { name: "contextbridge", version: "0.2.0" } } });
  if (m.method === "ping") return send({ jsonrpc: "2.0", id: m.id, result: {} });
  if (m.method === "tools/list") return send({ jsonrpc: "2.0", id: m.id, result: { tools } });
  if (m.method === "tools/call") {
    try {
      const name = m.params?.name;
      if (name === "read_project_state") {
        const state = await readState();
        return send({ jsonrpc: "2.0", id: m.id, result: { content: [{ type: "text", text: JSON.stringify(state, null, 2) }] } });
      }
      if (name === "update_project_state") {
        const state = m.params?.arguments?.state;
        if (!validState(state)) throw new Error("Provide a full state with project and current_task objects.");
        const data = JSON.stringify(state, null, 2);
        if (Buffer.byteLength(data) > 1_000_000) throw new Error("Project state exceeds 1 MB.");
        await mkdir(dir, { recursive: true });
        try { await rename(stateFile, path.join(dir, `project_state.${Date.now()}.bak.json`)); } catch (e) { if (e.code !== "ENOENT") throw e; }
        await writeFile(stateFile, data, { encoding: "utf8", flag: "wx" });
        return send({ jsonrpc: "2.0", id: m.id, result: { content: [{ type: "text", text: `Saved ${stateFile}; previous snapshot backed up when present.` }] } });
      }
      throw new Error(`Unknown tool: ${String(name)}`);
    } catch (e) {
      return send({ jsonrpc: "2.0", id: m.id, result: { isError: true, content: [{ type: "text", text: e instanceof Error ? e.message : "Tool failed." }] } });
    }
  }
  if (m.id !== undefined) send({ jsonrpc: "2.0", id: m.id, error: { code: -32601, message: `Method not found: ${m.method}` } });
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", (line) => { try { const m = JSON.parse(line); Promise.resolve(handle(m)).catch(() => send({ jsonrpc: "2.0", id: m.id, error: { code: -32603, message: "Internal error" } })); } catch { /* Ignore malformed input without emitting non-protocol output. */ } });
