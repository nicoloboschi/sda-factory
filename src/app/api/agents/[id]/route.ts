import { NextResponse } from "next/server";
import { deleteProfile, getGoal, getProfile, putModel, setGoal } from "@/lib/hermes/dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const profile = await getProfile(id);
    if (!profile) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    const goal = await getGoal(id);
    return NextResponse.json({ profile, goal });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const body = await req.json();
    if (typeof body.goal === "string") await setGoal(id, body.goal);
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
