import "server-only";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { DEFAULT_SDA_COMMAND, SETTINGS_FILE, STATE_DIR } from "./config";

/** App settings persisted at ~/.hermes/.sda-factory/settings.json. */
interface AppSettings {
  /** Base command for the self-driving-agents CLI. */
  sdaCommand?: string;
}

function read(): AppSettings {
  try {
    if (existsSync(SETTINGS_FILE)) return JSON.parse(readFileSync(SETTINGS_FILE, "utf-8"));
  } catch {
    /* ignore */
  }
  return {};
}

function write(settings: AppSettings) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2) + "\n");
}

/**
 * Resolve the SDA CLI base command. Precedence: env override > saved setting >
 * built-in default.
 */
export function getSdaCommand(): string {
  return process.env.SDA_INSTALL_COMMAND || read().sdaCommand || DEFAULT_SDA_COMMAND;
}

/** Whether the command is pinned by an env var (so the UI can show it read-only). */
export function sdaCommandFromEnv(): boolean {
  return Boolean(process.env.SDA_INSTALL_COMMAND);
}

export function setSdaCommand(command: string) {
  const cmd = command.trim();
  const settings = read();
  if (cmd && cmd !== DEFAULT_SDA_COMMAND) settings.sdaCommand = cmd;
  else delete settings.sdaCommand;
  write(settings);
}
