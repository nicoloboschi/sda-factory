import { NextResponse } from "next/server";
import {
  deleteProfile,
  getProfile,
  getSoul,
  putDescription,
  putModel,
  putSoul,
} from "@/lib/hermes/dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const profile = await getProfile(id);
    if (!profile) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    const soul = await getSoul(id);
    return NextResponse.json({ profile, soul });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const body = await req.json();
    if (typeof body.soul === "string") await putSoul(id, body.soul);
    if (typeof body.description === "string") await putDescription(id, body.description);
    if (body.provider && body.model) await putModel(id, body.provider, body.model);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    await deleteProfile(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
