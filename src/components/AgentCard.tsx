"use client";

import Link from "next/link";
import { useState } from "react";
import type { HermesProfile } from "@/lib/hermes/types";

export function AgentCard({
  profile,
  onDeleted,
}: {
  profile: HermesProfile;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function remove(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete agent "${profile.name}"? This removes its Hermes profile.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(profile.name)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Delete failed");
      }
      onDeleted();
    } catch (err) {
      alert((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Link href={`/agents/${encodeURIComponent(profile.name)}`} className="card block p-5 transition-colors hover:border-[var(--accent)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-medium">{profile.name}</h3>
            {profile.is_default && (
              <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
                default
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">
            {profile.description || "No description"}
          </p>
        </div>
        <button
          onClick={remove}
          disabled={busy || profile.is_default}
          title={profile.is_default ? "Can't delete the default profile" : "Delete agent"}
          className="shrink-0 rounded-md px-2 py-1 text-xs text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-red-400 disabled:opacity-30"
        >
          ✕
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-[var(--muted)]">
        <span className="rounded bg-[var(--surface-2)] px-2 py-1 font-mono">{profile.model ?? "no model"}</span>
        <span className="rounded bg-[var(--surface-2)] px-2 py-1">{profile.skill_count} skills</span>
        {profile.distribution_name && (
          <span className="rounded bg-[var(--surface-2)] px-2 py-1">{profile.distribution_name}</span>
        )}
      </div>
    </Link>
  );
}
