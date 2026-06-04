import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { HINDSIGHT_CONFIG } from "./config";

/**
 * Reads an agent's "mental models" — the long-term knowledge pages the SDA
 * `agent-knowledge` skill maintains in its Hindsight bank.
 *
 * We resolve the bank exactly the way the installed `hindsight-sda` plugin does
 * (its `_load_config`): read `$HERMES_HOME/hindsight/config.json` for THAT
 * profile — `~/.hermes/profiles/<id>/hindsight/config.json`, or `~/.hermes` for
 * the default profile — and take `api_url`, `api_key` (sent as the bearer token),
 * and `bank_id` (defaulting to the literal "hermes" when the key is absent).
 *
 * Crucially there is NO cross-agent fallback: if a profile has no
 * hindsight/config.json it simply has no mental-models bank — we report that
 * rather than guessing another agent's bank. A legacy per-agent location
 * (`~/.self-driving-agents/hermes/<id>/config.json`, used by older installs) is
 * accepted only for the exact same agent id.
 */

export interface HindsightConn {
  apiUrl: string;
  apiKey?: string;
  bankId: string;
  /** where the connection came from, for display/debugging. */
  source: "profile" | "legacy";
}

export interface MentalModel {
  id: string;
  name: string;
  source_query: string | null;
  content: string | null;
  last_refreshed_at: string | null;
  created_at: string | null;
  is_stale: boolean | null;
}

/** `$HERMES_HOME/hindsight/config.json` for the agent's profile — the exact path the plugin reads. */
function profileHindsightPath(agentId: string): string {
  if (agentId === "default") return HINDSIGHT_CONFIG;
  return join(homedir(), ".hermes", "profiles", agentId, "hindsight", "config.json");
}

/** Legacy per-agent config written by older `--harness hermes` installs. */
function legacySdaPath(agentId: string): string {
  return join(homedir(), ".self-driving-agents", "hermes", agentId, "config.json");
}

export function resolveHindsight(agentId: string): HindsightConn | null {
  const candidates: Array<{ path: string; source: "profile" | "legacy" }> = [
    { path: profileHindsightPath(agentId), source: "profile" },
    { path: legacySdaPath(agentId), source: "legacy" },
  ];
  for (const { path, source } of candidates) {
    if (!existsSync(path)) continue;
    try {
      const cfg = JSON.parse(readFileSync(path, "utf-8"));
      if (!cfg.api_url) continue;
      // Mirror the plugin: token is `api_key` (profile config) or `api_token`
      // (legacy), and bank_id defaults to the literal "hermes".
      return {
        apiUrl: String(cfg.api_url).replace(/\/$/, ""),
        apiKey: cfg.api_key ?? cfg.api_token,
        bankId: cfg.bank_id || "hermes",
        source,
      };
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

export async function listMentalModels(agentId: string): Promise<{
  conn: HindsightConn | null;
  items: MentalModel[];
}> {
  const conn = resolveHindsight(agentId);
  if (!conn) return { conn: null, items: [] };

  const url = `${conn.apiUrl}/v1/default/banks/${encodeURIComponent(conn.bankId)}/mental-models?detail=full`;
  const res = await fetch(url, {
    headers: {
      "content-type": "application/json",
      ...(conn.apiKey ? { authorization: `Bearer ${conn.apiKey}` } : {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`Hindsight API ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  }
  const data = (await res.json()) as { items?: MentalModel[] };
  return { conn, items: data.items ?? [] };
}
