import "server-only";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  baseUrlFor,
  CHAT_PORT_BASE,
  HERMES_HOST,
  MANAGEMENT_PORT,
  SESSION_HEADER,
  STATE_DIR,
  STATE_FILE,
} from "./config";

/**
 * Owns the pool of `hermes dashboard --tui` backends.
 *
 * One management backend (default profile) + one chat backend per SDA, each
 * launched with `-p <id>` so its tui_gateway chat is bound to that profile.
 * All share a single session token we inject via HERMES_DASHBOARD_SESSION_TOKEN.
 */

export interface Backend {
  baseUrl: string;
  port: number;
  token: string;
}

interface State {
  token: string;
  managementPort: number;
  /** profileId -> chat dashboard port */
  chatPorts: Record<string, number>;
  nextChatPort: number;
}

const g = globalThis as unknown as {
  __sdaToken?: string;
  __sdaPending?: Map<string, Promise<Backend>>;
};
g.__sdaPending ??= new Map();

function loadState(): State {
  try {
    if (existsSync(STATE_FILE)) return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
  } catch {
    /* ignore */
  }
  return { token: "", managementPort: MANAGEMENT_PORT, chatPorts: {}, nextChatPort: CHAT_PORT_BASE };
}

function saveState(state: State) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function token(): string {
  if (g.__sdaToken) return g.__sdaToken;
  const t =
    process.env.HERMES_DASHBOARD_SESSION_TOKEN ||
    loadState().token ||
    randomBytes(24).toString("base64url");
  g.__sdaToken = t;
  return t;
}

async function statusOk(port: number): Promise<boolean> {
  try {
    const r = await fetch(`${baseUrlFor(port)}/api/status`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch {
    return false;
  }
}

async function tokenWorks(port: number): Promise<boolean> {
  try {
    const r = await fetch(`${baseUrlFor(port)}/api/profiles`, {
      headers: { [SESSION_HEADER]: token() },
      signal: AbortSignal.timeout(3000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

function spawnDashboard(port: number, profileId?: string) {
  const args = profileId ? ["-p", profileId, "dashboard"] : ["dashboard"];
  args.push("--no-open", "--tui", "--host", HERMES_HOST, "--port", String(port));
  const env: NodeJS.ProcessEnv = { ...process.env, HERMES_DASHBOARD_SESSION_TOKEN: token() };
  // Chat backends run the SDA autonomously: bypass interactive tool approvals
  // (same as `hermes -z` oneshot mode) so the agent doesn't block on prompts.
  if (profileId) env.HERMES_YOLO_MODE = "1";
  const child = spawn("hermes", args, { env, detached: true, stdio: "ignore" });
  child.on("error", (err) =>
    console.error(`[sda] spawn hermes dashboard (${profileId ?? "management"}) failed:`, err.message),
  );
  child.unref();
}

async function waitReady(port: number): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await statusOk(port)) return;
    await new Promise((r) => setTimeout(r, 750));
  }
  throw new Error(`Timed out waiting for hermes dashboard on port ${port}. Is hermes installed?`);
}

async function ensureOn(port: number, profileId?: string): Promise<Backend> {
  if (await statusOk(port)) {
    if (await tokenWorks(port)) return { baseUrl: baseUrlFor(port), port, token: token() };
    throw new Error(
      `A Hermes dashboard already runs on port ${port} but rejects our token. ` +
        `Stop it or set HERMES_DASHBOARD_SESSION_TOKEN to match.`,
    );
  }
  spawnDashboard(port, profileId);
  await waitReady(port);
  return { baseUrl: baseUrlFor(port), port, token: token() };
}

/**
 * Dedup *concurrent* ensure() calls for the same key, but never cache a
 * resolved backend permanently — the in-flight entry is cleared once settled
 * so a later call re-validates liveness (and re-spawns if the dashboard died).
 */
function once(key: string, fn: () => Promise<Backend>): Promise<Backend> {
  const pending = g.__sdaPending!;
  if (!pending.has(key)) {
    const p = fn().finally(() => pending.delete(key));
    pending.set(key, p);
  }
  return pending.get(key)!;
}

/** The management backend (default profile) used for all REST profile ops. */
export function ensureManagementBackend(): Promise<Backend> {
  return once("__management__", async () => {
    const state = loadState();
    state.token = token();
    saveState(state);
    return ensureOn(state.managementPort);
  });
}

/**
 * The chat backend bound to a specific SDA profile.
 *
 * Resilient to port squatters: if the mapped/next port is held by a foreign
 * dashboard (status ok but our token rejected), advance to the next port and
 * retry, so a leftover process never wedges the agent.
 */
export function ensureChatBackend(profileId: string): Promise<Backend> {
  return once(`chat:${profileId}`, async () => {
    const state = loadState();
    state.token = token();
    let port = state.chatPorts[profileId] ?? state.nextChatPort;

    for (let attempt = 0; attempt < 10; attempt++, port++) {
      // Reuse only our own backend on a port; skip foreign squatters.
      if ((await statusOk(port)) && !(await tokenWorks(port))) continue;
      try {
        const backend = await ensureOn(port, profileId);
        state.chatPorts[profileId] = port;
        state.nextChatPort = Math.max(state.nextChatPort, port + 1);
        saveState(state);
        return backend;
      } catch {
        // Port raced or rejected — try the next one.
      }
    }
    throw new Error(`Could not find a free port for agent "${profileId}" near ${CHAT_PORT_BASE}.`);
  });
}
