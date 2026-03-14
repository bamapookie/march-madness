import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  validateCompetitionSettings,
  getLockAtForCompetition,
  isCompetitionLocked,
  isJoinCutoffPassed,
  validateJoinCutoffAt,
  getDefaultCompetitionSettings,
} from "@/lib/competition";
import type { ApiResponse, CompetitionSummary } from "@/types";

// ─── Helper: map DB row → CompetitionSummary ──────────────────────────────────

type SeasonRow = { firstFourLockAt: Date; roundOf64LockAt: Date };

function mapToSummary(
  comp: {
    id: string;
    name: string;
    description: string | null;
    isPublic: boolean;
    organizerId: string;
    joinCode: string;
    joinCutoffAt: Date | null;
    settingsJson: unknown;
    organizer: { name: string | null };
    _count: { members: number; entries: number };
    createdAt: Date;
    updatedAt: Date;
  },
  season: SeasonRow,
  userId: string | null,
  userEntryCount: number
): CompetitionSummary {
  const settings = comp.settingsJson as CompetitionSummary["settings"];
  const lockAt = getLockAtForCompetition(settings, season);
  return {
    id: comp.id,
    name: comp.name,
    description: comp.description,
    isPublic: comp.isPublic,
    organizerId: comp.organizerId,
    organizerName: comp.organizer.name,
    memberCount: comp._count.members,
    entryCount: comp._count.entries,
    isLocked: isCompetitionLocked(settings, season),
    lockAt: lockAt.toISOString(),
    joinCutoffAt: comp.joinCutoffAt ? comp.joinCutoffAt.toISOString() : null,
    isJoinable: !isCompetitionLocked(settings, season) && !isJoinCutoffPassed(comp.joinCutoffAt),
    joinCode: comp.joinCode,
    userEntryCount,
    isOrganizer: userId === comp.organizerId,
    isMember: false, // overridden by caller when known
    settings,
  };
}

// ─── GET /api/competitions ────────────────────────────────────────────────────

export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ data: null, error: "Unauthorized" } satisfies ApiResponse<null>, {
      status: 401,
    });
  }

  const season = await db.tournamentSeason.findFirst({ where: { isActive: true } });
  if (!season) {
    return Response.json({ data: [], error: null } satisfies ApiResponse<CompetitionSummary[]>);
  }

  // All competitions where the user is a member (joined)
  const memberships = await db.competitionMember.findMany({
    where: { userId: session.user.id },
    select: { competitionId: true },
  });
  const memberIds = memberships.map((m) => m.competitionId);

  const competitions = await db.competition.findMany({
    where: { id: { in: memberIds }, seasonId: season.id },
    include: {
      organizer: { select: { name: true } },
      _count: { select: { members: true, entries: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Count user's own entries per competition
  const entryCounts = await db.competitionEntry.groupBy({
    by: ["competitionId"],
    where: { userId: session.user.id, competitionId: { in: memberIds } },
    _count: { id: true },
  });
  const entryCountMap = new Map(entryCounts.map((e) => [e.competitionId, e._count.id]));

  const result: CompetitionSummary[] = competitions.map((comp) => {
    const summary = mapToSummary(comp, season, session.user.id, entryCountMap.get(comp.id) ?? 0);
    summary.isMember = true;
    return summary;
  });

  return Response.json({ data: result, error: null } satisfies ApiResponse<CompetitionSummary[]>);
}

// ─── POST /api/competitions ───────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ data: null, error: "Unauthorized" } satisfies ApiResponse<null>, {
      status: 401,
    });
  }

  let body: {
    name?: unknown;
    description?: unknown;
    isPublic?: unknown;
    joinCutoffAt?: unknown;
    settings?: unknown;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ data: null, error: "Invalid JSON body" } satisfies ApiResponse<null>, {
      status: 400,
    });
  }

  const name = (typeof body.name === "string" ? body.name : "").trim();
  if (!name) {
    return Response.json({ data: null, error: "name is required" } satisfies ApiResponse<null>, {
      status: 400,
    });
  }

  const settingsRaw = body.settings ?? getDefaultCompetitionSettings();
  const validation = validateCompetitionSettings(settingsRaw);
  if (!validation.valid) {
    return Response.json({ data: null, error: validation.error } satisfies ApiResponse<null>, {
      status: 400,
    });
  }
  const settings = validation.settings;

  const season = await db.tournamentSeason.findFirst({ where: { isActive: true } });
  if (!season) {
    return Response.json(
      { data: null, error: "No active tournament season" } satisfies ApiResponse<null>,
      { status: 404 }
    );
  }

  const lockAt = getLockAtForCompetition(settings, season);

  let joinCutoffAt: Date | null = null;
  if (body.joinCutoffAt !== undefined && body.joinCutoffAt !== null) {
    const parsed = new Date(body.joinCutoffAt as string);
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
    joinCutoffAt = parsed;
  }

  const joinCode = randomBytes(4).toString("hex");

  const competition = await db.competition.create({
    data: {
      seasonId: season.id,
      organizerId: session.user.id,
      name,
      description: typeof body.description === "string" ? body.description.trim() || null : null,
      isPublic: body.isPublic === true,
      settingsJson: settings,
      joinCode,
      joinCutoffAt,
      members: {
        create: { userId: session.user.id },
      },
    },
    include: {
      organizer: { select: { name: true } },
      _count: { select: { members: true, entries: true } },
    },
  });

  const summary = mapToSummary(competition, season, session.user.id, 0);
  summary.isMember = true;

  return Response.json({ data: summary, error: null } satisfies ApiResponse<CompetitionSummary>, {
    status: 201,
  });
}
