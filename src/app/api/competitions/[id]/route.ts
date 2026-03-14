import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getLockAtForCompetition,
  isCompetitionLocked,
  isJoinCutoffPassed,
  validateJoinCutoffAt,
  canViewCompetition,
} from "@/lib/competition";
import type {
  ApiResponse,
  CompetitionDetail,
  CompetitionSummary,
  CompetitionMemberSummary,
  CompetitionEntrySummary,
  CompetitionUpdateInput,
} from "@/types";

// ─── GET /api/competitions/[id] ───────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ data: null, error: "Unauthorized" } satisfies ApiResponse<null>, {
      status: 401,
    });
  }

  const { id } = await params;
  const userId = session.user.id;

  const season = await db.tournamentSeason.findFirst({ where: { isActive: true } });
  if (!season) {
    return Response.json(
      { data: null, error: "No active tournament season" } satisfies ApiResponse<null>,
      { status: 404 }
    );
  }

  const comp = await db.competition.findUnique({
    where: { id },
    include: {
      organizer: { select: { name: true } },
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      },
      entries: {
        include: {
          user: { select: { id: true, name: true } },
          rankingList: { select: { id: true, name: true } },
        },
        orderBy: { submittedAt: "asc" },
      },
    },
  });

  if (!comp) {
    return Response.json(
      { data: null, error: "Competition not found" } satisfies ApiResponse<null>,
      { status: 404 }
    );
  }

  const isMember = comp.members.some((m) => m.userId === userId);
  const userEntries = comp.entries.filter((e) => e.userId === userId);
  const hasEntry = userEntries.length > 0;

  if (
    !canViewCompetition(
      {
        organizerId: comp.organizerId,
        isPublic: comp.isPublic,
        joinCutoffAt: comp.joinCutoffAt,
        settingsJson: comp.settingsJson,
      },
      season,
      userId,
      isMember,
      hasEntry
    )
  ) {
    return Response.json({ data: null, error: "Forbidden" } satisfies ApiResponse<null>, {
      status: 403,
    });
  }

  const settings = comp.settingsJson as CompetitionSummary["settings"];
  const lockAt = getLockAtForCompetition(settings, season);

  // Build per-member entry count
  const memberEntryCounts = new Map<string, number>();
  for (const entry of comp.entries) {
    memberEntryCounts.set(entry.userId, (memberEntryCounts.get(entry.userId) ?? 0) + 1);
  }

  const members: CompetitionMemberSummary[] = comp.members.map((m) => ({
    id: m.id,
    userId: m.user.id,
    userName: m.user.name,
    userEmail: m.user.email,
    userImage: m.user.image,
    entryCount: memberEntryCounts.get(m.user.id) ?? 0,
    joinedAt: m.joinedAt.toISOString(),
  }));

  const mapEntry = (e: (typeof comp.entries)[number]): CompetitionEntrySummary => ({
    id: e.id,
    userId: e.userId,
    userName: e.user.name,
    rankingListId: e.rankingList.id,
    rankingListName: e.rankingList.name,
    submittedAt: e.submittedAt.toISOString(),
  });

  const allEntries: CompetitionEntrySummary[] = comp.entries.map(mapEntry);
  const userEntriesMapped: CompetitionEntrySummary[] = userEntries.map(mapEntry);

  const detail: CompetitionDetail = {
    id: comp.id,
    name: comp.name,
    description: comp.description,
    isPublic: comp.isPublic,
    organizerId: comp.organizerId,
    organizerName: comp.organizer.name,
    memberCount: comp.members.length,
    entryCount: comp.entries.length,
    isLocked: isCompetitionLocked(settings, season),
    lockAt: lockAt.toISOString(),
    joinCutoffAt: comp.joinCutoffAt ? comp.joinCutoffAt.toISOString() : null,
    isJoinable: !isCompetitionLocked(settings, season) && !isJoinCutoffPassed(comp.joinCutoffAt),
    joinCode: comp.joinCode,
    userEntryCount: userEntries.length,
    isOrganizer: userId === comp.organizerId,
    isMember,
    settings,
    members,
    entries: allEntries,
    userEntries: userEntriesMapped,
  };

  return Response.json({ data: detail, error: null } satisfies ApiResponse<CompetitionDetail>);
}

// ─── PATCH /api/competitions/[id] ─────────────────────────────────────────────

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ data: null, error: "Unauthorized" } satisfies ApiResponse<null>, {
      status: 401,
    });
  }

  const { id } = await params;
  const userId = session.user.id;

  const season = await db.tournamentSeason.findFirst({ where: { isActive: true } });
  if (!season) {
    return Response.json(
      { data: null, error: "No active tournament season" } satisfies ApiResponse<null>,
      { status: 404 }
    );
  }

  const comp = await db.competition.findUnique({
    where: { id },
    include: {
      organizer: { select: { name: true } },
      _count: { select: { members: true, entries: true } },
    },
  });

  if (!comp) {
    return Response.json(
      { data: null, error: "Competition not found" } satisfies ApiResponse<null>,
      { status: 404 }
    );
  }

  if (comp.organizerId !== userId) {
    return Response.json(
      {
        data: null,
        error: "Forbidden — only the organizer can update settings",
      } satisfies ApiResponse<null>,
      { status: 403 }
    );
  }

  const settings = comp.settingsJson as CompetitionSummary["settings"];

  if (isCompetitionLocked(settings, season)) {
    return Response.json(
      {
        data: null,
        error: "Competition is locked — no changes permitted",
      } satisfies ApiResponse<null>,
      { status: 409 }
    );
  }

  if (isJoinCutoffPassed(comp.joinCutoffAt)) {
    return Response.json(
      {
        data: null,
        error: "Join cutoff has passed — settings can no longer be changed",
      } satisfies ApiResponse<null>,
      { status: 409 }
    );
  }

  let body: CompetitionUpdateInput = {};
  try {
    body = (await req.json()) as CompetitionUpdateInput;
  } catch {
    return Response.json({ data: null, error: "Invalid JSON body" } satisfies ApiResponse<null>, {
      status: 400,
    });
  }

  const lockAt = getLockAtForCompetition(settings, season);

  let newJoinCutoffAt: Date | null | undefined = undefined;
  if ("joinCutoffAt" in body) {
    if (body.joinCutoffAt === null || body.joinCutoffAt === undefined) {
      newJoinCutoffAt = null;
    } else {
      const parsed = new Date(body.joinCutoffAt);
      if (isNaN(parsed.getTime())) {
        return Response.json(
          {
            data: null,
            error: "joinCutoffAt must be a valid ISO-8601 date",
          } satisfies ApiResponse<null>,
          { status: 400 }
        );
      }
      if (!validateJoinCutoffAt(parsed, lockAt)) {
        return Response.json(
          {
            data: null,
            error: "joinCutoffAt must be ≤ the competition lock time",
          } satisfies ApiResponse<null>,
          { status: 400 }
        );
      }
      newJoinCutoffAt = parsed;
    }
  }

  const updated = await db.competition.update({
    where: { id },
    data: {
      ...(body.isPublic !== undefined ? { isPublic: body.isPublic } : {}),
      ...(newJoinCutoffAt !== undefined ? { joinCutoffAt: newJoinCutoffAt } : {}),
    },
    include: {
      organizer: { select: { name: true } },
      _count: { select: { members: true, entries: true } },
    },
  });

  const userEntryCount = await db.competitionEntry.count({
    where: { competitionId: id, userId },
  });

  const updatedSettings = updated.settingsJson as CompetitionSummary["settings"];
  const updatedLockAt = getLockAtForCompetition(updatedSettings, season);

  const summary: CompetitionSummary = {
    id: updated.id,
    name: updated.name,
    description: updated.description,
    isPublic: updated.isPublic,
    organizerId: updated.organizerId,
    organizerName: updated.organizer.name,
    memberCount: updated._count.members,
    entryCount: updated._count.entries,
    isLocked: isCompetitionLocked(updatedSettings, season),
    lockAt: updatedLockAt.toISOString(),
    joinCutoffAt: updated.joinCutoffAt ? updated.joinCutoffAt.toISOString() : null,
    isJoinable:
      !isCompetitionLocked(updatedSettings, season) && !isJoinCutoffPassed(updated.joinCutoffAt),
    joinCode: updated.joinCode,
    userEntryCount,
    isOrganizer: true,
    isMember: true,
    settings: updatedSettings,
  };

  return Response.json({ data: summary, error: null } satisfies ApiResponse<CompetitionSummary>);
}
