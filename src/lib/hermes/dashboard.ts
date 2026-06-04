import "server-only";
import { ensureManagementBackend } from "./backend";
import { SESSION_HEADER } from "./config";
import type { CreateAgentInput, HermesProfile } from "./types";

/** Authenticated fetch against the management dashboard. */
async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const { baseUrl, token } = await ensureManagementBackend();
  const headers = new Headers(init.headers);
  headers.set(SESSION_HEADER, token);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return fetch(`${baseUrl}${path}`, { ...init, headers, cache: "no-store" });
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || body.error || detail;
    } catch {
      /* ignore */
    }
    throw new Error(`Hermes API ${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

export async function listProfiles(): Promise<HermesProfile[]> {
  const data = await json<{ profiles: HermesProfile[] }>(await api("/api/profiles"));
  return data.profiles;
}

export async function getProfile(name: string): Promise<HermesProfile | null> {
  const profiles = await listProfiles();
  return profiles.find((p) => p.name === name) ?? null;
}

export async function createProfile(input: CreateAgentInput): Promise<{ name: string; path: string }> {
  const res = await api("/api/profiles", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      description: input.description ?? "",
      clone_from_default: true,
      provider: input.provider,
      model: input.model,
    }),
  });
  return json(res);
}

export async function deleteProfile(name: string): Promise<void> {
  await json(await api(`/api/profiles/${encodeURIComponent(name)}`, { method: "DELETE" }));
}

export async function getSoul(name: string): Promise<string> {
  const data = await json<{ content: string; exists: boolean }>(
    await api(`/api/profiles/${encodeURIComponent(name)}/soul`),
  );
  return data.content ?? "";
}

export async function putSoul(name: string, content: string): Promise<void> {
  await json(
    await api(`/api/profiles/${encodeURIComponent(name)}/soul`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),
  );
}

export async function putDescription(name: string, description: string): Promise<void> {
  await json(
    await api(`/api/profiles/${encodeURIComponent(name)}/description`, {
      method: "PUT",
      body: JSON.stringify({ description }),
    }),
  );
}

export async function putModel(name: string, provider: string, model: string): Promise<void> {
  await json(
    await api(`/api/profiles/${encodeURIComponent(name)}/model`, {
      method: "PUT",
      body: JSON.stringify({ provider, model }),
    }),
  );
}
