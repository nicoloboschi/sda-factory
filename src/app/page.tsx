"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { HermesProfile } from "@/lib/hermes/types";
import { AgentCard } from "@/components/AgentCard";

export default function AgentsPage() {
  const [profiles, setProfiles] = useState<HermesProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/agents");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load agents");
      setProfiles(data.profiles);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Agents</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Each agent is a Hermes profile. Open one to chat with it.
          </p>
        </div>
        <Link href="/new" className="btn btn-accent">+ New agent</Link>
      </div>

      {error && (
        <div className="card mb-4 p-4 text-sm">
          <p className="font-medium text-red-400">Couldn&apos;t reach Hermes</p>
          <p className="mt-1 text-[var(--muted)]">{error}</p>
          <button onClick={load} className="btn btn-ghost mt-3">Retry</button>
        </div>
      )}

      {!profiles && !error && (
        <p className="text-sm text-[var(--muted)]">Starting Hermes and loading agents…</p>
      )}

      {profiles && profiles.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-[var(--muted)]">No agents yet.</p>
          <Link href="/new" className="btn btn-accent mt-4">Create your first agent</Link>
        </div>
      )}

      {profiles && profiles.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((p) => (
            <AgentCard key={p.name} profile={p} onDeleted={load} />
          ))}
        </div>
      )}
    </div>
  );
}
