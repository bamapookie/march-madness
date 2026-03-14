import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { runFullImport } from "@/lib/import";
import { db } from "@/lib/db";

export async function POST() {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 });
  }

  const season = await db.tournamentSeason.findFirst({
    where: { isActive: true },
    select: { id: true },
  });

  if (!season) {
    return NextResponse.json(
      { data: null, error: "No active tournament season found" },
      { status: 404 }
    );
  }

  const result = await runFullImport(season.id);

  if (!result.success) {
    return NextResponse.json({ data: null, error: result.error ?? "Import failed" }, { status: 500 });
  }

  return NextResponse.json({ data: result, error: null });
}

