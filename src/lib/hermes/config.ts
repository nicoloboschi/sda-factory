import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Central config for talking to the single Hermes dashboard backend.
 *
 * The SDA Factory runs ONE `hermes dashboard --tui` process and talks to it:
 *   - REST  /api/*        -> profile management (list / create / configure)
 *   - WS    /api/ws       -> tui_gateway chat protocol
 *
 * Auth is the dashboard's ephemeral session token (loopback mode):
 *   - REST: header `X-Hermes-Session-Token: <token>`
 *   - WS:   query   `?token=<token>`
 * We mint the token ourselves and inject it via `HERMES_DASHBOARD_SESSION_TOKEN`
 * when we spawn the backend — exactly how the official desktop app authenticates.
 */

/**
 * Topology: a pool of `hermes dashboard --tui` processes.
 *   - MANAGEMENT (default profile, MANAGEMENT_PORT): lists/creates/configures
 *     every profile by name. `/api/profiles` from here sees all SDAs.
 *   - CHAT (per agent, `hermes -p <id> dashboard --tui`, CHAT_PORT_BASE+n):
 *     the tui_gateway chat is pinned to the launch profile, so each SDA gets
 *     its own backend bound to its HERMES_HOME.
 */
export const HERMES_HOST = "127.0.0.1";
export const MANAGEMENT_PORT = Number(process.env.HERMES_DASHBOARD_PORT) || 9119;
export const CHAT_PORT_BASE = Number(process.env.HERMES_CHAT_PORT_BASE) || 9120;

export const baseUrlFor = (port: number) => `http://${HERMES_HOST}:${port}`;
export const wsUrlFor = (port: number, token: string) =>
  `ws://${HERMES_HOST}:${port}/api/ws?token=${encodeURIComponent(token)}`;

export const SESSION_HEADER = "X-Hermes-Session-Token";

/** Where we persist the minted token + backend state across dev-server reloads. */
export const STATE_DIR = join(homedir(), ".hermes", ".sda-factory");
export const STATE_FILE = join(STATE_DIR, "state.json");
export const SETTINGS_FILE = join(STATE_DIR, "settings.json");

/**
 * Base command for the self-driving-agents CLI. Configurable so you can point at
 * a local dev build (e.g. `npx tsx /path/to/self-driving-agents/src/cli.ts`).
 * The installer appends `install <target> --harness hermes [--empty]`.
 */
export const DEFAULT_SDA_COMMAND = "npx --yes @vectorize-io/self-driving-agents";

/** Slug rule mirrors Hermes' own profile-name validation. */
export const PROFILE_NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export const HINDSIGHT_CONFIG = join(homedir(), ".hermes", "hindsight", "config.json");
