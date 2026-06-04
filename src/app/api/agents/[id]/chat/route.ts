import { NextResponse } from "next/server";
import { ensureChatBackend } from "@/lib/hermes/backend";
import { wsUrlFor } from "@/lib/hermes/config";
import { getProfile } from "@/lib/hermes/dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Boot (or reuse) the chat backend bound to this SDA's profile and hand the
 * browser a ready-to-use tui_gateway WebSocket URL.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const profile = await getProfile(id);
    if (!profile) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    const backend = await ensureChatBackend(id);
    return NextResponse.json({
      wsUrl: wsUrlFor(backend.port, backend.token),
      port: backend.port,
      model: profile.model,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
