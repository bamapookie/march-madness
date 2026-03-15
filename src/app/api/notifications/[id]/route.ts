import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ApiResponse } from "@/types";

// ─── PATCH /api/notifications/[id] — mark one read ───────────────────────────

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ data: null, error: "Unauthorized" } satisfies ApiResponse<null>, {
      status: 401,
    });
  }

  const { id } = await params;

  const notification = await db.notification.findUnique({ where: { id } });
  if (!notification || notification.userId !== session.user.id) {
    return NextResponse.json({ data: null, error: "Not found" } satisfies ApiResponse<null>, {
      status: 404,
    });
  }

  await db.notification.update({ where: { id }, data: { isRead: true } });

  return NextResponse.json({ data: { ok: true }, error: null } satisfies ApiResponse<{
    ok: boolean;
  }>);
}

// ─── DELETE /api/notifications/[id] ──────────────────────────────────────────

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ data: null, error: "Unauthorized" } satisfies ApiResponse<null>, {
      status: 401,
    });
  }

  const { id } = await params;

  const notification = await db.notification.findUnique({ where: { id } });
  if (!notification || notification.userId !== session.user.id) {
    return NextResponse.json({ data: null, error: "Not found" } satisfies ApiResponse<null>, {
      status: 404,
    });
  }

  await db.notification.delete({ where: { id } });

  return NextResponse.json({ data: { ok: true }, error: null } satisfies ApiResponse<{
    ok: boolean;
  }>);
}
