import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import type { ApiResponse } from "@/types";

type DbStatusResult = { ok: true; latencyMs: number } | { ok: false; error: string };

/** GET /api/admin/db-status — ping the DB and return connection health. */
export async function GET(): Promise<Response> {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ data: null, error: "Forbidden" } satisfies ApiResponse<null>, {
      status: 403,
    });
  }

  const start = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - start;
    return NextResponse.json({
      data: { ok: true, latencyMs },
      error: null,
    } satisfies ApiResponse<DbStatusResult>);
  } catch (err) {
    return NextResponse.json({
      data: { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      error: null,
    } satisfies ApiResponse<DbStatusResult>);
  }
}
