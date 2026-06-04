import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { HINDSIGHT_CONFIG } from "@/lib/hermes/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PATH_RE = /^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/;

/**
 * Stream `npx @vectorize-io/self-driving-agents install <path> --harness hermes`
 * output as SSE. Best-effort: the upstream installer is interactive (clack) and
 * needs Hindsight credentials at ~/.hermes/hindsight/config.json (configure in
 * Settings first). On failure, the UI shows the exact command to run manually.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const path = String(body.path ?? "");
  if (!PATH_RE.test(path)) {
    return new Response("Invalid catalog path", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      if (!existsSync(HINDSIGHT_CONFIG)) {
        send({
          line:
            "⚠ No Hindsight credentials found (~/.hermes/hindsight/config.json). " +
            "Set them in Settings, or run the command below in a terminal.",
        });
      }

      const child = spawn(
        "npx",
        ["--yes", "@vectorize-io/self-driving-agents", "install", path, "--harness", "hermes"],
        { env: { ...process.env, CI: "1" }, stdio: ["pipe", "pipe", "pipe"] },
      );

      // Best-effort auto-confirm of clack prompts.
      const nudge = setInterval(() => {
        try {
          child.stdin.write("\n");
        } catch {
          /* ignore */
        }
      }, 1500);

      const onData = (buf: Buffer) => {
        for (const line of buf.toString().split("\n")) {
          // Strip ANSI for cleaner display.
          const clean = line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd();
          if (clean) send({ line: clean });
        }
      };
      child.stdout.on("data", onData);
      child.stderr.on("data", onData);

      child.on("error", (err) => {
        send({ line: `✕ ${err.message}` });
        send({ done: true, code: 1 });
        clearInterval(nudge);
        controller.close();
      });
      child.on("close", (code) => {
        clearInterval(nudge);
        send({ done: true, code: code ?? 0 });
        controller.close();
      });

      req.signal.addEventListener("abort", () => {
        clearInterval(nudge);
        child.kill();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
