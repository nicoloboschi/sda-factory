import { NextResponse } from "next/server";
import { createProfile, listProfiles, setGoal } from "@/lib/hermes/dashboard";
import { PROFILE_NAME_RE } from "@/lib/hermes/config";
import { readGoalFromPath } from "@/lib/hermes/goal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const profiles = await listProfiles();
    // Augment each profile with its Goal (read cheaply from the profile's SOUL.md).
    for (const p of profiles) p.goal = readGoalFromPath(p.path);
    return NextResponse.json({ profiles });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    if (!PROFILE_NAME_RE.test(name)) {
      return NextResponse.json(
        { error: "Name must be lowercase letters, numbers, '-' or '_' (max 64 chars)." },
        { status: 400 },
      );
    }
    const result = await createProfile({
      name,
      model: body.model,
      provider: body.provider,
    });
    if (body.goal && String(body.goal).trim()) {
      await setGoal(name, String(body.goal));
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
