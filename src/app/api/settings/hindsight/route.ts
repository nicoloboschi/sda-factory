import { NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { HINDSIGHT_CONFIG } from "@/lib/hermes/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read current Hindsight connection (token redacted) from ~/.hermes/hindsight/config.json. */
export async function GET() {
  try {
    const cfg = JSON.parse(await readFile(HINDSIGHT_CONFIG, "utf-8"));
    return NextResponse.json({
      api_url: cfg.api_url ?? "https://api.hindsight.vectorize.io",
      has_token: Boolean(cfg.api_key),
    });
  } catch {
    return NextResponse.json({ api_url: "https://api.hindsight.vectorize.io", has_token: false });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const api_url = String(body.api_url ?? "").trim();
    const api_key = String(body.api_key ?? "").trim();
    if (!api_url || !api_key) {
      return NextResponse.json({ error: "API URL and token are required" }, { status: 400 });
    }
    let existing: Record<string, unknown> = {};
    try {
      existing = JSON.parse(await readFile(HINDSIGHT_CONFIG, "utf-8"));
    } catch {
      /* first write */
    }
    await mkdir(dirname(HINDSIGHT_CONFIG), { recursive: true });
    await writeFile(
      HINDSIGHT_CONFIG,
      JSON.stringify({ mode: "cloud", recall_budget: "mid", memory_mode: "hybrid", ...existing, api_url, api_key }, null, 2) + "\n",
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
