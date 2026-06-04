"use client";

import { useEffect, useState } from "react";
import type { HermesProfile } from "@/lib/hermes/types";
import { Spinner } from "@/components/Spinner";

export function ConfigPanel({ agentId }: { agentId: string }) {
  const [profile, setProfile] = useState<HermesProfile | null>(null);
  const [soul, setSoul] = useState("");
  const [description, setDescription] = useState("");
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}`);
      const data = await res.json();
      if (res.ok) {
        setProfile(data.profile);
        setSoul(data.soul ?? "");
        setDescription(data.profile.description ?? "");
        setProvider(data.profile.provider ?? "");
        setModel(data.profile.model ?? "");
      }
      setLoading(false);
    })();
  }, [agentId]);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ soul, description, provider, model }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setMsg("Saved. Reopen the chat to apply changes.");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="card p-6"><Spinner label="Loading config…" /></div>;
  if (!profile) return <p className="text-sm text-red-400">Agent not found.</p>;

  return (
    <div className="card max-w-2xl space-y-5 overflow-y-auto p-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Provider</label>
          <input className="input font-mono" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="gemini" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Model</label>
          <input className="input font-mono" value={model} onChange={(e) => setModel(e.target.value)} placeholder="gemini-3.1-flash-lite-preview" />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">Description</label>
        <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">System prompt (SOUL.md)</label>
        <textarea className="input min-h-48 resize-y font-mono text-xs" value={soul} onChange={(e) => setSoul(e.target.value)} />
      </div>

      <div className="flex flex-wrap gap-2 text-[11px] text-[var(--muted)]">
        <span className="rounded bg-[var(--surface-2)] px-2 py-1">{profile.skill_count} skills</span>
        <span className="rounded bg-[var(--surface-2)] px-2 py-1 font-mono">{profile.path}</span>
      </div>

      {msg && <p className="text-sm text-[var(--muted)]">{msg}</p>}

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="btn btn-accent">
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
