"use client";

import { useEffect, useState } from "react";

export default function SettingsPage() {
  // Hindsight credentials
  const [apiUrl, setApiUrl] = useState("https://api.hindsight.vectorize.io");
  const [apiKey, setApiKey] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [savingHs, setSavingHs] = useState(false);
  const [hsMsg, setHsMsg] = useState<string | null>(null);

  // SDA CLI command
  const [sdaCommand, setSdaCommand] = useState("");
  const [sdaDefault, setSdaDefault] = useState("");
  const [sdaFromEnv, setSdaFromEnv] = useState(false);
  const [savingSda, setSavingSda] = useState(false);
  const [sdaMsg, setSdaMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/hindsight")
      .then((r) => r.json())
      .then((d) => {
        if (d.api_url) setApiUrl(d.api_url);
        setHasToken(Boolean(d.has_token));
      });
    fetch("/api/settings/sda")
      .then((r) => r.json())
      .then((d) => {
        setSdaCommand(d.command ?? "");
        setSdaDefault(d.default ?? "");
        setSdaFromEnv(Boolean(d.fromEnv));
      });
  }, []);

  async function saveHindsight() {
    setSavingHs(true);
    setHsMsg(null);
    try {
      const res = await fetch("/api/settings/hindsight", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ api_url: apiUrl, api_key: apiKey }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Save failed");
      setHsMsg("Saved.");
      setHasToken(true);
      setApiKey("");
    } catch (e) {
      setHsMsg((e as Error).message);
    } finally {
      setSavingHs(false);
    }
  }

  async function saveSda() {
    setSavingSda(true);
    setSdaMsg(null);
    try {
      const res = await fetch("/api/settings/sda", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ command: sdaCommand }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Save failed");
      setSdaCommand(d.command);
      setSdaMsg("Saved.");
    } catch (e) {
      setSdaMsg((e as Error).message);
    } finally {
      setSavingSda(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
      </div>

      {/* Hindsight credentials */}
      <section>
        <h2 className="text-sm font-semibold">Hindsight</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Used when creating/installing agents (their memory is backed by a Hindsight bank). Stored at{" "}
          <code>~/.hermes/hindsight/config.json</code>.
        </p>
        <div className="card mt-3 space-y-5 p-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Hindsight API URL</label>
            <input className="input font-mono" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              API token{" "}
              {hasToken && <span className="text-[var(--muted)]">(set — enter a new one to replace)</span>}
            </label>
            <input
              type="password"
              className="input font-mono"
              placeholder={hasToken ? "••••••••" : "hsk_…"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          {hsMsg && <p className="text-sm text-[var(--muted)]">{hsMsg}</p>}
          <div className="flex justify-end">
            <button onClick={saveHindsight} disabled={savingHs || !apiKey} className="btn btn-accent">
              {savingHs ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </section>

      {/* SDA CLI command */}
      <section>
        <h2 className="text-sm font-semibold">Self-driving-agents CLI</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          The base command used to create and install agents. Change it to point at a local build, e.g.{" "}
          <code>npx tsx /path/to/self-driving-agents/src/cli.ts</code>. The app appends{" "}
          <code>install &lt;agent&gt; --harness hermes</code>.
        </p>
        <div className="card mt-3 space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium">CLI command</label>
            <input
              className="input font-mono"
              value={sdaCommand}
              disabled={sdaFromEnv}
              onChange={(e) => setSdaCommand(e.target.value)}
              placeholder={sdaDefault}
            />
            {sdaFromEnv ? (
              <p className="mt-1 text-xs text-[var(--muted)]">
                Pinned by the <code>SDA_INSTALL_COMMAND</code> env var.
              </p>
            ) : (
              <p className="mt-1 text-xs text-[var(--muted)]">
                Default: <code>{sdaDefault}</code>. Leave equal to the default to clear the override.
              </p>
            )}
          </div>
          {sdaMsg && <p className="text-sm text-[var(--muted)]">{sdaMsg}</p>}
          <div className="flex justify-end gap-2">
            {!sdaFromEnv && sdaCommand !== sdaDefault && (
              <button onClick={() => setSdaCommand(sdaDefault)} className="btn btn-ghost">
                Reset to default
              </button>
            )}
            <button onClick={saveSda} disabled={savingSda || sdaFromEnv} className="btn btn-accent">
              {savingSda ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
