import "server-only";
import { spawn, type IPty } from "node-pty";
import { homedir } from "node:os";
import { getSdaCommand } from "./settings";

/**
 * Runs the self-driving-agents installer through a real PTY.
 *
 * The installer (clack-based) needs a TTY: with piped stdin its prompts cancel
 * and it bails. A pseudo-terminal lets us auto-accept the one prompt that
 * appears when Hindsight credentials already exist ("Hindsight: <url>. Use
 * this?") by sending Enter, so blank (`--empty`) and catalog installs run
 * unattended. Credentials must already be at ~/.hermes/hindsight/config.json
 * (configure them in Settings).
 */

export interface InstallEvent {
  line?: string;
  done?: boolean;
  code?: number;
}

const ANSI = /\x1b\[[0-9;?]*[A-Za-z]/g;

/** target is validated upstream to `[a-z0-9_-]+` or `<dept>/<agent>`, so it's shell-safe. */
function buildCommand(opts: { target: string; empty?: boolean }): string {
  const flag = opts.empty ? " --empty" : "";
  return `${getSdaCommand()} install ${opts.target} --harness hermes${flag}`;
}

export function runInstall(
  opts: { target: string; empty?: boolean },
  onEvent: (e: InstallEvent) => void,
  signal?: AbortSignal,
): IPty {
  // Spawn through a login shell: node-pty can't posix_spawn the `npx` script
  // directly, and a login shell resolves the user's PATH (node/npx) reliably.
  const shell = process.env.SHELL || "/bin/bash";
  const command = buildCommand(opts);
  // Surface the actual resolved command (honors the configured SDA CLI command).
  onEvent({ line: `$ ${command}` });
  const child = spawn(shell, ["-lc", command], {
    name: "xterm-color",
    cols: 100,
    rows: 30,
    cwd: homedir(),
    env: process.env as Record<string, string>,
  });

  let buf = "";
  let lastPrompt = "";

  child.onData((data) => {
    // Accept the default for each clack prompt by sending Enter once per
    // distinct prompt. Our prompts all have the right default: the agent name
    // (pre-filled from the positional arg) and "Hindsight … Use this?" (Yes).
    const m = data.replace(ANSI, "").match(/◆\s+([^\r\n│]+?)\s*$/m);
    if (m) {
      const label = m[1].trim();
      if (label && label !== lastPrompt) {
        lastPrompt = label;
        setTimeout(() => {
          try {
            child.write("\r");
          } catch {
            /* ignore */
          }
        }, 350);
      }
    }

    buf += data.replace(ANSI, "");
    const lines = buf.split(/\r?\n/);
    buf = lines.pop() ?? "";
    for (const raw of lines) {
      const line = raw.replace(/[\r\x00-\x08\x0b\x0c\x0e-\x1f]/g, "").trimEnd();
      if (line && !/^[●○│┌└◇◆�diamond\s]*$/.test(line)) onEvent({ line });
    }
  });

  child.onExit(({ exitCode }) => {
    const tail = buf.replace(ANSI, "").trim();
    if (tail) onEvent({ line: tail });
    onEvent({ done: true, code: exitCode });
  });

  signal?.addEventListener("abort", () => {
    try {
      child.kill();
    } catch {
      /* ignore */
    }
  });

  return child;
}
