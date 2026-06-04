import { NextResponse } from "next/server";
import { DEFAULT_SDA_COMMAND } from "@/lib/hermes/config";
import { getSdaCommand, sdaCommandFromEnv, setSdaCommand } from "@/lib/hermes/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    command: getSdaCommand(),
    default: DEFAULT_SDA_COMMAND,
    fromEnv: sdaCommandFromEnv(),
  });
}

export async function PUT(req: Request) {
  try {
    if (sdaCommandFromEnv()) {
      return NextResponse.json(
        { error: "The SDA command is pinned by the SDA_INSTALL_COMMAND env var." },
        { status: 409 },
      );
    }
    const body = await req.json();
    setSdaCommand(String(body.command ?? ""));
    return NextResponse.json({ ok: true, command: getSdaCommand() });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
