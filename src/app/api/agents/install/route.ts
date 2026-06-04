import { existsSync } from "node:fs";
import { runInstall } from "@/lib/hermes/installer";
import { HINDSIGHT_CONFIG, PROFILE_NAME_RE } from "@/lib/hermes/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATALOG_PATH_RE = /^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/;

/**
 * Install an agent via the SDA installer and stream its output as SSE.
 *   - blank:   { name, empty: true }  -> install <name> --harness hermes --empty
 *   - catalog: { path }               -> install <path> --harness hermes
 * Both provision a Hindsight bank, so the agent has memory + mental models.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  let target: string;
  let empty = false;
  if (body.empty) {
    target = String(body.name ?? "").trim();
    if (!PROFILE_NAME_RE.test(target)) return new Response("Invalid agent name", { status: 400 });
    empty = true;
  } else {
    target = String(body.path ?? "").trim();
    if (!CATALOG_PATH_RE.test(target)) return new Response("Invalid catalog path", { status: 400 });
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
            "Set them in Settings first — the installer needs them to provision the bank.",
        });
      }

      runInstall(
        { target, empty },
        (e) => {
          send(e);
          if (e.done) {
            try {
              controller.close();
            } catch {
              /* already closed */
            }
          }
        },
        req.signal,
      );
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
