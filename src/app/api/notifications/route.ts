import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ApiResponse, NotificationSummary } from "@/types";

// ─── GET /api/notifications ───────────────────────────────────────────────────

export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ data: null, error: "Unauthorized" } satisfies ApiResponse<null>, {
      status: 401,
    });
  }

  const rows = await db.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, title: true, body: true, isRead: true, link: true, createdAt: true },
  });

  const data: NotificationSummary[] = rows.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    isRead: n.isRead,
    link: n.link,
    createdAt: n.createdAt.toISOString(),
  }));

  return NextResponse.json({ data, error: null } satisfies ApiResponse<NotificationSummary[]>);
}

// ─── PATCH /api/notifications — mark all read ─────────────────────────────────

export async function PATCH(): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ data: null, error: "Unauthorized" } satisfies ApiResponse<null>, {
      status: 401,
    });
  }

  const result = await db.notification.updateMany({
    where: { userId: session.user.id, isRead: false },
    data: { isRead: true },
  });

  return NextResponse.json({ data: { count: result.count }, error: null } satisfies ApiResponse<{
    count: number;
  }>);
}
