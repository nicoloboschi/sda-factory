import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The agent's "Goal" is injected into its SOUL.md as a managed block delimited
 * by markers, so we can read/update just the goal without clobbering the rest of
 * the persona file.
 */

const START = "<!-- sda-factory:goal:start -->";
const END = "<!-- sda-factory:goal:end -->";
const BLOCK_RE = new RegExp(`\\n*${START}[\\s\\S]*?${END}\\n*`);

/** Pull the goal text out of a SOUL.md body (empty string if none). */
export function extractGoal(soul: string): string {
  const m = soul.match(new RegExp(`${START}([\\s\\S]*?)${END}`));
  if (!m) return "";
  return m[1].replace(/^\s*##\s*Goal\s*\n/, "").trim();
}

/** Insert/replace/remove the managed goal block in a SOUL.md body. */
export function injectGoal(soul: string, goal: string): string {
  const trimmed = goal.trim();
  const block = `${START}\n## Goal\n\n${trimmed}\n${END}`;
  if (BLOCK_RE.test(soul)) {
    return trimmed ? soul.replace(BLOCK_RE, `\n\n${block}\n`).replace(/^\n+/, "") : soul.replace(BLOCK_RE, "\n");
  }
  if (!trimmed) return soul;
  const base = soul.trimEnd();
  return base ? `${base}\n\n${block}\n` : `${block}\n`;
}

/** Read the goal directly from a profile dir's SOUL.md (for cheap list display). */
export function readGoalFromPath(profilePath: string): string {
  try {
    const p = join(profilePath, "SOUL.md");
    if (existsSync(p)) return extractGoal(readFileSync(p, "utf-8"));
  } catch {
    /* ignore */
  }
  return "";
}
