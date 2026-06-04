import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { HINDSIGHT_CONFIG } from "./config";

/**
 * Reads an agent's "mental models" — the long-term knowledge pages the SDA
 * `agent-knowledge` skill maintains in its Hindsight bank.
 *
 * Each Hermes profile may carry its own Hindsight connection at
 * `~/.hermes/profiles/<id>/hindsight/config.json` (written when an agent is
 * installed from the catalog); otherwise it falls back to the default
 * `~/.hermes/hindsight/config.json`. The connection gives us {api_url, api_key,
 * bank_id}, and mental models live at `/v1/default/banks/<bank_id>/mental-models`.
 */

export interface HindsightConn {
  apiUrl: string;
  apiKey?: string;
  bankId: string;
  /** "profile" if the agent has its own bank, "default" if it shares the default. */
  source: "profile" | "default";
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

function profileHindsightPath(agentId: string): string {
  if (agentId === "default") return HINDSIGHT_CONFIG;
  return join(homedir(), ".hermes", "profiles", agentId, "hindsight", "config.json");
}

export function resolveHindsight(agentId: string): HindsightConn | null {
  const profilePath = profileHindsightPath(agentId);
  const candidates: Array<{ path: string; source: "profile" | "default" }> = [
    { path: profilePath, source: agentId === "default" ? "default" : "profile" },
    { path: HINDSIGHT_CONFIG, source: "default" },
  ];
  for (const { path, source } of candidates) {
    if (!existsSync(path)) continue;
    try {
      const cfg = JSON.parse(readFileSync(path, "utf-8"));
      if (cfg.api_url && cfg.bank_id) {
        return { apiUrl: String(cfg.api_url).replace(/\/$/, ""), apiKey: cfg.api_key, bankId: cfg.bank_id, source };
      }
    } catch {
      /* try next */
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
