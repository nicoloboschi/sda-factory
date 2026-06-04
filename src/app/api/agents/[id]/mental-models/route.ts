import { NextResponse } from "next/server";
import { listMentalModels } from "@/lib/hermes/hindsight";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const { conn, items } = await listMentalModels(id);
    return NextResponse.json({
      configured: conn !== null,
      bankId: conn?.bankId ?? null,
      source: conn?.source ?? null,
      items,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
