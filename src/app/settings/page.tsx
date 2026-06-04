"use client";

import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [apiUrl, setApiUrl] = useState("https://api.hindsight.vectorize.io");
  const [apiKey, setApiKey] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/hindsight")
      .then((r) => r.json())
      .then((d) => {
        if (d.api_url) setApiUrl(d.api_url);
        setHasToken(Boolean(d.has_token));
      });
  }, []);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings/hindsight", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ api_url: apiUrl, api_key: apiKey }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Save failed");
      setMsg("Saved.");
      setHasToken(true);
      setApiKey("");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Hindsight credentials are used when installing agents from the catalog (their memory is
        backed by a Hindsight bank). Stored at <code>~/.hermes/hindsight/config.json</code>.
      </p>

      <div className="card mt-6 space-y-5 p-6">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Hindsight API URL</label>
          <input className="input font-mono" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            API token {hasToken && <span className="text-[var(--muted)]">(a token is already set — enter a new one to replace)</span>}
          </label>
          <input
            type="password"
            className="input font-mono"
            placeholder={hasToken ? "••••••••" : "hs_…"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
        {msg && <p className="text-sm text-[var(--muted)]">{msg}</p>}
        <div className="flex justify-end">
          <button onClick={save} disabled={saving || !apiKey} className="btn btn-accent">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
