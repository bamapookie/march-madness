import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveInitialBracket } from "@/lib/bracket";
import type {
  ApiResponse,
  ActualResultItem,
  BracketSlotInput,
  BracketViewerResponse,
  ResolvedBracketData,
  Round,
} from "@/types";

// ─── GET /api/ranking-lists/[id]/bracket ─────────────────────────────────────

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

  const { id: rankingListId } = await params;
  const userId = session.user.id;

  const season = await db.tournamentSeason.findFirst({ where: { isActive: true } });
  if (!season) {
    return Response.json(
      { data: null, error: "No active tournament season" } satisfies ApiResponse<null>,
      { status: 404 }
    );
  }

  const rankingList = await db.rankingList.findUnique({
    where: { id: rankingListId },
    select: {
      id: true,
      userId: true,
      entries: { select: { schoolId: true, rank: true } },
    },
  });

  if (!rankingList || rankingList.userId !== userId) {
    return Response.json(
      { data: null, error: "Ranking list not found" } satisfies ApiResponse<null>,
      { status: 404 }
    );
  }

  const rankMap: Record<string, number> = {};
  for (const e of rankingList.entries) {
    rankMap[e.schoolId] = e.rank;
  }

  // Load bracket slots
  const slotsRaw = await db.bracketSlot.findMany({
    where: { seasonId: season.id },
    select: {
      id: true,
      gender: true,
      round: true,
      slotIndex: true,
      region: true,
      schoolId: true,
      nextSlotId: true,
      feedingSlots: { select: { id: true } },
    },
  });

  const toInput = (s: (typeof slotsRaw)[number]): BracketSlotInput => ({
    id: s.id,
    round: s.round as Round,
    slotIndex: s.slotIndex,
    region: s.region,
    schoolId: s.schoolId,
    nextSlotId: s.nextSlotId,
    feedingSlotIds: s.feedingSlots.map((f) => f.id),
  });

  const mensSlots = slotsRaw.filter((s) => s.gender === "MENS").map(toInput);
  const womensSlots = slotsRaw.filter((s) => s.gender === "WOMENS").map(toInput);

  if (mensSlots.length === 0 || womensSlots.length === 0) {
    return Response.json(
      {
        data: null,
        error: "Bracket slots not yet available for this season",
      } satisfies ApiResponse<null>,
      { status: 404 }
    );
  }

  let mensBracket: ResolvedBracketData;
  let womensBracket: ResolvedBracketData;
  try {
    mensBracket = resolveInitialBracket({ gender: "MENS", slots: mensSlots, rankMap });
    womensBracket = resolveInitialBracket({ gender: "WOMENS", slots: womensSlots, rankMap });
  } catch (err) {
    return Response.json(
      {
        data: null,
        error: `Failed to resolve bracket: ${err instanceof Error ? err.message : String(err)}`,
      } satisfies ApiResponse<null>,
      { status: 500 }
    );
  }

  // Actual results
  const resultsRaw = await db.tournamentResult.findMany({
    where: { seasonId: season.id },
    select: { bracketSlotId: true, winningSchoolId: true, losingSchoolId: true },
  });
  const actualResults: ActualResultItem[] = resultsRaw.map((r) => ({
    bracketSlotId: r.bracketSlotId,
    winningSchoolId: r.winningSchoolId,
    losingSchoolId: r.losingSchoolId,
  }));

  // In-progress slots
  const inProgressSlots = await db.bracketSlot.findMany({
    where: { seasonId: season.id, isInProgress: true },
    select: { id: true },
  });
  const inProgressSlotIds = inProgressSlots.map((s) => s.id);

  // School names map
  const schools = await db.school.findMany({
    where: { seasonId: season.id },
    select: { id: true, name: true, shortName: true },
  });
  const schoolNames: Record<string, string> = {};
  for (const s of schools) {
    schoolNames[s.id] = s.shortName ?? s.name;
  }

  // Return both genders
  const response = {
    resolvedBracketMens: mensBracket,
    resolvedBracketWomens: womensBracket,
    actualResults,
    inProgressSlotIds,
    schoolNames,
  };

  return Response.json({ data: response, error: null } satisfies ApiResponse<typeof response>);
}
