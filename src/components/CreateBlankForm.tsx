"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Phase = "form" | "installing" | "error";

export function CreateBlankForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [soul, setSoul] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const logRef = useRef<HTMLPreElement>(null);

  const validName = /^[a-z0-9][a-z0-9_-]{0,63}$/.test(name);

  useEffect(() => {
    fetch("/api/settings/hindsight")
      .then((r) => r.json())
      .then((d) => setHasToken(Boolean(d.has_token)))
      .catch(() => setHasToken(false));
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [log]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPhase("installing");
    setError(null);
    setLog([`$ npx @vectorize-io/self-driving-agents install ${name} --harness hermes --empty`]);
    try {
      const res = await fetch("/api/agents/install", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, empty: true }),
      });
      if (!res.ok || !res.body) throw new Error((await res.text()) || "Install failed to start");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let code: number | null = null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop() ?? "";
        for (const ev of events) {
          const data = ev.replace(/^data: /, "");
          if (!data) continue;
          const obj = JSON.parse(data);
          if (obj.line) setLog((l) => [...l, obj.line]);
          if (obj.done) code = obj.code;
        }
      }

      if (code !== 0) throw new Error("The installer did not finish — see the log above.");

      // The installer created the profile + bank; apply name-only extras.
      if (soul.trim() || description.trim()) {
        await fetch(`/api/agents/${encodeURIComponent(name)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ soul, description }),
        });
      }
      router.push(`/agents/${encodeURIComponent(name)}`);
    } catch (err) {
      setError((err as Error).message);
      setPhase("error");
    }
  }

  if (phase !== "form") {
    return (
      <div className="card space-y-3 p-6">
        <p className="text-sm font-medium">
          {phase === "installing" ? `Creating ${name}…` : `Couldn't create ${name}`}
        </p>
        <pre
          ref={logRef}
          className="max-h-80 overflow-y-auto rounded-lg bg-black/40 p-3 font-mono text-[11px] leading-relaxed"
        >
          {log.join("\n")}
        </pre>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {phase === "error" && (
          <button onClick={() => setPhase("form")} className="btn btn-ghost">Back</button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-5 p-6">
      {hasToken === false && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm">
          <p className="text-yellow-300">No Hindsight credentials set.</p>
          <p className="mt-1 text-[var(--muted)]">
            Blank agents are provisioned with a Hindsight memory bank, which needs an API token.{" "}
            <Link href="/settings" className="underline">Add it in Settings</Link>.
          </p>
        </div>
      )}

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
          Lowercase letters, numbers, <code>-</code> or <code>_</code>. Becomes the Hermes profile id and
          Hindsight bank.
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

      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--muted)]">Provisions a blank Hindsight bank (≈1–2 min).</p>
        <button type="submit" disabled={!validName} className="btn btn-accent">
          Create agent
        </button>
      </div>
    </form>
  );
}
