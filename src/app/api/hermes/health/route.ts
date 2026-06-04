import { NextResponse } from "next/server";
import { ensureManagementBackend } from "@/lib/hermes/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Preflight: ensure the management backend is up; surface a clear error if not. */
export async function GET() {
  try {
    const backend = await ensureManagementBackend();
    const status = await fetch(`${backend.baseUrl}/api/status`, {
      signal: AbortSignal.timeout(3000),
    }).then((r) => r.json());
    return NextResponse.json({ ok: true, port: backend.port, version: status.version });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 503 });
  }
}
