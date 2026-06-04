import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { CatalogDepartment } from "@/lib/hermes/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const raw = await readFile(join(process.cwd(), "data", "catalog.json"), "utf-8");
    const catalog = JSON.parse(raw) as CatalogDepartment[];
    return NextResponse.json({ catalog });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
