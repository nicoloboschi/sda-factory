/**
 * Regenerate data/catalog.json from a local clone of the self-driving-agents repo.
 *
 *   git clone https://github.com/vectorize-io/self-driving-agents /tmp/sda-src
 *   npx tsx scripts/gen-catalog.ts /tmp/sda-src
 *
 * Catalog layout: <department>/<agent>/ (markdown seed files). The install path
 * passed to `npx @vectorize-io/self-driving-agents install <path>` is "<dept>/<agent>".
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DEPARTMENTS = [
  "design", "engineering", "finance", "game-development", "marketing",
  "paid-media", "product", "project-management", "sales", "spatial-computing",
  "specialized", "support", "testing",
];

const root = process.argv[2] ?? "/tmp/sda-src";

/** Parse a `key: value` from a markdown file's YAML frontmatter. */
function frontmatter(text: string, key: string): string {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return "";
  const line = m[1].split("\n").find((l) => l.startsWith(`${key}:`));
  return line ? line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "") : "";
}

/** Summarize a team dir from the frontmatter of its first specialist markdown. */
function summarize(dir: string): { count: number; description: string } {
  const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  for (const f of files) {
    const text = readFileSync(join(dir, f), "utf-8");
    const desc = frontmatter(text, "description") || frontmatter(text, "name");
    if (desc) return { count: files.length, description: desc.slice(0, 200) };
  }
  return { count: files.length, description: "" };
}

const prettify = (s: string) =>
  s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const catalog: {
  department: string;
  agents: { path: string; title: string; description: string; agentCount: number }[];
}[] = [];

for (const dept of DEPARTMENTS) {
  const deptDir = join(root, dept);
  let entries: string[];
  try {
    entries = readdirSync(deptDir);
  } catch {
    continue;
  }
  const agents = entries
    .filter((name) => {
      try {
        return statSync(join(deptDir, name)).isDirectory();
      } catch {
        return false;
      }
    })
    .map((name) => {
      const { count, description } = summarize(join(deptDir, name));
      return {
        path: `${dept}/${name}`,
        title: prettify(name),
        description,
        agentCount: count,
      };
    });
  if (agents.length) catalog.push({ department: prettify(dept), agents });
}

const out = join(process.cwd(), "data", "catalog.json");
writeFileSync(out, JSON.stringify(catalog, null, 2) + "\n");
console.log(`Wrote ${out} (${catalog.reduce((n, d) => n + d.agents.length, 0)} agents in ${catalog.length} departments)`);
