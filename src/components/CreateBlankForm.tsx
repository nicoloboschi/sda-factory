"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateBlankForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [soul, setSoul] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validName = /^[a-z0-9][a-z0-9_-]{0,63}$/.test(name);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, description, soul }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      router.push(`/agents/${encodeURIComponent(name)}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-5 p-6">
      <div>
        <label className="mb-1.5 block text-sm font-medium">Name</label>
        <input
          className="input font-mono"
          placeholder="my-agent"
          value={name}
          onChange={(e) => setName(e.target.value.toLowerCase())}
          autoFocus
        />
        <p className="mt-1 text-xs text-[var(--muted)]">
          Lowercase letters, numbers, <code>-</code> or <code>_</code>. Becomes the Hermes profile id.
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">Description</label>
        <input
          className="input"
          placeholder="What is this agent for?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">
          System prompt <span className="text-[var(--muted)]">(optional)</span>
        </label>
        <textarea
          className="input min-h-28 resize-y"
          placeholder="You are a focused engineering assistant that…"
          value={soul}
          onChange={(e) => setSoul(e.target.value)}
        />
        <p className="mt-1 text-xs text-[var(--muted)]">Written to the profile&apos;s SOUL.md.</p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="submit" disabled={!validName || busy} className="btn btn-accent">
          {busy ? "Creating…" : "Create agent"}
        </button>
      </div>
    </form>
  );
}
