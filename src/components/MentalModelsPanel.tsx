"use client";

import { useCallback, useEffect, useState } from "react";
import type { MentalModel } from "@/lib/hermes/hindsight";

interface Data {
  configured: boolean;
  bankId: string | null;
  source: "profile" | "legacy" | null;
  items: MentalModel[];
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const d = Date.parse(iso);
  if (Number.isNaN(d)) return "";
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function MentalModelsPanel({ agentId }: { agentId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/mental-models`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed to load mental models");
      setData(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="card flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b p-4">
        <div>
          <h2 className="font-medium">Mental models</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Long-term knowledge pages this agent maintains in Hindsight via the agent-knowledge skill.
          </p>
        </div>
        <button onClick={load} className="btn btn-ghost text-xs">Refresh</button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading && <p className="text-sm text-[var(--muted)]">Loading…</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}

        {!loading && !error && data && !data.configured && (
          <div className="text-sm text-[var(--muted)]">
            <p>This agent isn&apos;t connected to a Hindsight bank.</p>
            <p className="mt-2">
              Agents installed from the catalog get a bank automatically. Add Hindsight credentials in
              Settings to back blank agents with memory.
            </p>
          </div>
        )}

        {!loading && !error && data?.configured && (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-[var(--muted)]">
              <span className="rounded bg-[var(--surface-2)] px-2 py-1 font-mono">bank: {data.bankId}</span>
              {data.source === "legacy" && (
                <span className="rounded bg-[var(--surface-2)] px-2 py-1">legacy config</span>
              )}
              <span className="rounded bg-[var(--surface-2)] px-2 py-1">{data.items.length} models</span>
            </div>

            {data.items.length === 0 && (
              <p className="text-sm text-[var(--muted)]">
                No mental models yet. The agent creates them as it learns durable facts across
                conversations.
              </p>
            )}

            <div className="space-y-2">
              {data.items.map((m) => {
                const isOpen = open.has(m.id);
                return (
                  <div key={m.id} className="card overflow-hidden">
                    <button
                      onClick={() => toggle(m.id)}
                      className="flex w-full items-center justify-between gap-2 p-3 text-left hover:bg-[var(--surface-2)]"
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-medium">{m.name || m.id}</span>
                          {m.is_stale && (
                            <span className="rounded bg-yellow-500/15 px-1.5 py-0.5 text-[10px] text-yellow-400">
                              stale
                            </span>
                          )}
                        </span>
                        <span className="block truncate font-mono text-[11px] text-[var(--muted)]">{m.id}</span>
                      </span>
                      <span className="shrink-0 text-[11px] text-[var(--muted)]">
                        {m.last_refreshed_at ? `refreshed ${timeAgo(m.last_refreshed_at)}` : ""}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="border-t p-3 text-sm">
                        {m.source_query && (
                          <div className="mb-3">
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                              Source query
                            </p>
                            <p className="italic text-[var(--muted)]">{m.source_query}</p>
                          </div>
                        )}
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                          Content
                        </p>
                        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                          {m.content || "(empty — not yet consolidated)"}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
