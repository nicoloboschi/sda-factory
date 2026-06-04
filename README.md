# SDA Factory

A local UI to build and run a fleet of **Self-Driving Agents (SDAs)** on the
[Hermes](https://github.com/NousResearch/hermes-agent) harness.

- **List agents** — every SDA is a Hermes *profile*.
- **Create agent** — a blank profile, or install a pre-built agent from the
  [self-driving-agents](https://github.com/vectorize-io/self-driving-agents) catalog.
- **Agent page** — chat with the agent (default view) and configure its model,
  system prompt, and description.

> One harness (Hermes), one profile per SDA. Runs locally. No Docker (yet).

## How it works

The app doesn't reimplement Hermes — it drives Hermes' own dashboard API, the
same way the official Hermes desktop app does:

- A **management** dashboard (`hermes dashboard --tui`, port `9119`) provides the
  REST profile API used for **List / Create / Configure / Delete**.
- A **per-agent chat** dashboard (`hermes -p <id> dashboard --tui`) is spawned
  lazily for each agent you open and bound to that profile's memory. Chat streams
  over its `tui_gateway` WebSocket (`/api/ws`) — real token streaming, tool calls,
  and thinking.

Both are spawned automatically with an injected session token; you never start
Hermes by hand. Chat backends run in autonomous (`HERMES_YOLO_MODE`) mode so the
agent doesn't block on tool approvals.

```
Browser ──HTTP──▶ Next.js API ──REST (X-Hermes-Session-Token)──▶ management dashboard :9119
Browser ──WS────▶ hermes -p <id> dashboard --tui  :9120+   (tui_gateway chat, per agent)
```

## Prerequisites

- **Node.js 20+**
- **Hermes** installed and on your `PATH`:
  ```bash
  curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
  ```
  Make sure a model/provider is configured (e.g. `hermes model`) so agents can reply.
- For **catalog installs**: a Hindsight API token (set it in **Settings**).

## Run

```bash
npm install
npm run dev
```

Open <http://localhost:3939>.

The first request boots the management dashboard (~10–20s); opening an agent boots
its chat backend the same way.

## Configuration

| Env var | Default | Purpose |
| --- | --- | --- |
| `HERMES_DASHBOARD_PORT` | `9119` | Management dashboard port |
| `HERMES_CHAT_PORT_BASE` | `9120` | First port for per-agent chat backends |
| `HERMES_DASHBOARD_SESSION_TOKEN` | random | Token injected into spawned dashboards; set to reuse one you started yourself |

State (the minted token + per-agent port map) lives in
`~/.hermes/.sda-factory/state.json`.

## Catalog

`data/catalog.json` is a manifest of installable catalog agents. Regenerate it
from a local clone of the catalog repo:

```bash
git clone https://github.com/vectorize-io/self-driving-agents /tmp/sda-src
npx tsx scripts/gen-catalog.ts /tmp/sda-src
```

Catalog installs shell out to `npx @vectorize-io/self-driving-agents install
<path> --harness hermes`. That installer is interactive; the UI streams its
output best-effort and, if it can't complete non-interactively, shows the exact
command to run in a terminal.

## Project layout

```
src/
  app/
    page.tsx                # List agents
    new/                    # Create (Blank | Catalog)
    agents/[id]/            # Agent page: Chat + Configure
    settings/               # Hindsight credentials
    api/                    # agents, chat bootstrap, catalog, settings, health
  components/               # AgentCard, ChatWindow, ConfigPanel, CatalogPicker, …
  lib/
    chat-client.ts          # browser tui_gateway WebSocket client
    hermes/                 # backend pool manager, REST client, config, types
data/catalog.json           # generated catalog manifest
scripts/gen-catalog.ts      # regenerate the manifest
```

## Notes

- **Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4.
- Hermes backends are spawned `detached` and outlive the dev server. Stop them
  with `pkill -f "hermes.*dashboard"` if needed.
- Tool approvals are auto-bypassed for chat (autonomous mode). Add a
  human-in-the-loop later by handling the `approval.request` event.
- Roadmap: move backends into Docker; per-agent approval UI; richer memory views.
