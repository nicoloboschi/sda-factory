"use client";

import { useEffect, useRef, useState } from "react";
import type { CatalogAgent, CatalogDepartment } from "@/lib/hermes/types";

export function CatalogPicker() {
  const [catalog, setCatalog] = useState<CatalogDepartment[] | null>(null);
  const [selected, setSelected] = useState<CatalogAgent | null>(null);
  const [installing, setInstalling] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [done, setDone] = useState<number | null>(null);
  const logRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((d) => setCatalog(d.catalog ?? []));
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [log]);

  async function install() {
    if (!selected) return;
    setInstalling(true);
    setDone(null);
    setLog([`$ npx @vectorize-io/self-driving-agents install ${selected.path} --harness hermes`]);
    try {
      const res = await fetch("/api/catalog/install", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: selected.path }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop() ?? "";
        for (const ev of events) {
          const line = ev.replace(/^data: /, "");
          if (!line) continue;
          const obj = JSON.parse(line);
          if (obj.line) setLog((l) => [...l, obj.line]);
          if (obj.done) setDone(obj.code);
        }
      }
    } catch (e) {
      setLog((l) => [...l, `✕ ${(e as Error).message}`]);
      setDone(1);
    } finally {
      setInstalling(false);
    }
  }

  if (!catalog) return <p className="text-sm text-[var(--muted)]">Loading catalog…</p>;

  return (
    <div className="space-y-6">
      <div className="max-h-[420px] space-y-6 overflow-y-auto pr-1">
        {catalog.map((dept) => (
          <div key={dept.department}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {dept.department}
            </h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {dept.agents.map((a) => (
                <button
                  key={a.path}
                  onClick={() => setSelected(a)}
                  className={`card p-3 text-left transition-colors hover:border-[var(--accent)] ${
                    selected?.path === a.path ? "border-[var(--accent)]" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{a.title}</span>
                    <span className="text-[10px] text-[var(--muted)]">{a.agentCount} agents</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">{a.description}</p>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="card space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{selected.title}</p>
              <p className="font-mono text-xs text-[var(--muted)]">{selected.path}</p>
            </div>
            <button onClick={install} disabled={installing} className="btn btn-accent">
              {installing ? "Installing…" : "Install"}
            </button>
          </div>

          {log.length > 0 && (
            <pre
              ref={logRef}
              className="max-h-60 overflow-y-auto rounded-lg bg-black/40 p-3 font-mono text-[11px] leading-relaxed"
            >
              {log.join("\n")}
            </pre>
          )}

          {done === 0 && <p className="text-sm text-green-400">✓ Installed. It now appears on the Agents page.</p>}
          {done != null && done !== 0 && (
            <p className="text-sm text-red-400">
              Install didn&apos;t complete. The installer is interactive — run the command above in a
              terminal, then refresh Agents.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
