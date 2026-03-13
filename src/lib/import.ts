/**
 * ESPN API import logic for tournament data.
 *
 * This module is a plain async library — it has NO scheduler.
 * It is called by:
 *   • GET /api/cron/import-results  (Vercel Cron Job)
 *   • POST /api/admin/import        (manual admin trigger)
 *   • npm run import:results        (dev script)
 *
 * All functions are idempotent (upsert-based). Safe to call repeatedly.
 *
 * ─── Slot index convention ───────────────────────────────────────────────────
 *
 *  FIRST_FOUR game slots:    indices  0 –  3   (1 per play-in game, in FF order)
 *  FIRST_FOUR leaf slots:    indices 50 – 57   (50 + ffIdx*2 + teamOffset)
 *
 *  ROUND_OF_64 game slots:   indices  0 – 31   (regionIdx * 8 + matchupPos)
 *  ROUND_OF_64 leaf slots:   indices 100 – 163 (100 + regionIdx * 16 + seedBracketPos)
 *
 *  ROUND_OF_32 game slots:   indices  0 – 15   (regionIdx * 4 + pos)
 *  SWEET_16 game slots:      indices  0 –  7   (regionIdx * 2 + pos)
 *  ELITE_8 game slots:       indices  0 –  3   (regionIdx)
 *  FINAL_FOUR game slots:    indices  0 –  1
 *  CHAMPIONSHIP game slot:   index    0
 */

import { db } from "@/lib/db";
import { recomputeAllScores } from "@/lib/scoring";
import type {
  EspnScoreboardResponse,
  EspnTeamsResponse,
  EspnTournamentGame,
  EspnTournamentResponse,
} from "@/types/espn";

// ─── Constants ────────────────────────────────────────────────────────────────

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/basketball";

const ESPN_PATHS = {
  MENS: "mens-college-basketball",
  WOMENS: "womens-college-basketball",
} as const;

/** NCAA Tournament group IDs used in the scoreboard `?groups=` query param. */
const ESPN_TOURNAMENT_GROUP_IDS = {
  MENS: "50",
  WOMENS: "49",
} as const;

/**
 * Bracket position matchups within a region, ordered top to bottom.
 * Index 0 = top of bracket, index 7 = bottom.
 * Each tuple is [high-seed, low-seed].
 */
const SEED_MATCHUPS: readonly [number, number][] = [
  [1, 16],
  [8, 9],
  [5, 12],
  [4, 13],
  [6, 11],
  [3, 14],
  [7, 10],
  [2, 15],
];

/**
 * Maps seed number → its 0-based bracket position within a region (0–15).
 * Positions alternate: top, bottom, top, bottom for each matchup.
 */
const SEED_BRACKET_POS: Readonly<Record<number, number>> = {
  1: 0,
  16: 1,
  8: 2,
  9: 3,
  5: 4,
  12: 5,
  4: 6,
  13: 7,
  6: 8,
  11: 9,
  3: 10,
  14: 11,
  7: 12,
  10: 13,
  2: 14,
  15: 15,
};

// ─── ESPN fetch wrapper ───────────────────────────────────────────────────────

/**
 * Thin wrapper around `fetch` for ESPN API calls.
 * Kept as a named export so tests can `vi.spyOn(importModule, 'fetchEspnJson')`.
 */
export async function fetchEspnJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 }, // always fetch fresh data
  });
  if (!res.ok) {
    throw new Error(`ESPN API error ${res.status} for ${url}`);
  }
  return res.json() as Promise<T>;
}

// ─── Tournament ID discovery ──────────────────────────────────────────────────

/**
 * Attempts to auto-discover the ESPN tournament ID for the given gender by
 * scanning the NCAA Tournament scoreboard for March dates.
 *
 * Returns null if no tournament event is found (e.g. before Selection Sunday).
 * In that case, set the ID manually via the admin panel.
 */
export async function discoverTournamentId(
  gender: keyof typeof ESPN_PATHS
): Promise<string | null> {
  const path = ESPN_PATHS[gender];
  const groupId = ESPN_TOURNAMENT_GROUP_IDS[gender];
  const year = new Date().getFullYear();

  // Try the most likely dates in order: First Four then Round of 64 window
  const marchDates = [
    `${year}0319`,
    `${year}0320`,
    `${year}0321`,
    `${year}0322`,
    `${year}0316`,
    `${year}0317`,
    `${year}0318`,
    `${year}0323`,
  ];

  for (const date of marchDates) {
    const url = `${ESPN_BASE}/${path}/scoreboard?groups=${groupId}&limit=100&dates=${date}`;
    let data: EspnScoreboardResponse;
    try {
      data = await fetchEspnJson<EspnScoreboardResponse>(url);
    } catch {
      continue;
    }

    // Try to find a tournament ID in the scoreboard response
    // Check leagues[].tournament.id first (most reliable)
    for (const league of data.leagues ?? []) {
      if (league.tournament?.id) return league.tournament.id;
    }

    // Fallback: check competition.tournament.id inside events
    for (const event of data.events ?? []) {
      for (const competition of event.competitions ?? []) {
        if (competition.tournament?.id) return competition.tournament.id;
      }
    }
  }

  return null;
}

// ─── importSchools ────────────────────────────────────────────────────────────

/**
 * Fetches the ESPN tournament bracket to determine which schools are in the
 * tournament, then enriches with shortDisplayName and abbreviation from the
 * teams endpoint. Upserts School rows by (seasonId, name).
 *
 * Returns counts of created and updated rows.
 */
export async function importSchools(
  seasonId: string,
  gender: keyof typeof ESPN_PATHS,
  espnTournamentId: string
): Promise<{ created: number; updated: number }> {
  const path = ESPN_PATHS[gender];
  const isMens = gender === "MENS";

  // 1. Fetch tournament bracket for tournament team list + seeds
  const tournament = await fetchEspnJson<EspnTournamentResponse>(
    `${ESPN_BASE}/${path}/tournaments/${espnTournamentId}`
  );

  // 2. Fetch teams endpoint for shortDisplayName and abbreviation
  let teamDetailsMap = new Map<string, { shortDisplayName: string; abbreviation: string }>();
  try {
    const teamsData = await fetchEspnJson<EspnTeamsResponse>(
      `${ESPN_BASE}/${path}/teams?limit=500`
    );
    for (const sport of teamsData.sports ?? []) {
      for (const league of sport.leagues ?? []) {
        for (const entry of league.teams ?? []) {
          const t = entry.team;
          teamDetailsMap.set(t.id, {
            shortDisplayName: t.shortDisplayName,
            abbreviation: t.abbreviation,
          });
        }
      }
    }
  } catch (err) {
    console.warn("[import] Failed to fetch teams endpoint for enrichment:", err);
    teamDetailsMap = new Map();
  }

  // 3. Extract all tournament teams from bracket groups
  let created = 0;
  let updated = 0;

  for (const group of tournament.groups ?? []) {
    for (const seedInfo of group.seeds ?? []) {
      for (const team of seedInfo.teams ?? []) {
        if (!team.id || !team.displayName) continue;

        const details = teamDetailsMap.get(team.id);

        const existing = await db.school.findUnique({
          where: { seasonId_name: { seasonId, name: team.displayName } },
        });

        if (existing) {
          await db.school.update({
            where: { id: existing.id },
            data: {
              shortName: details?.shortDisplayName ?? existing.shortName,
              abbreviation: details?.abbreviation ?? existing.abbreviation,
              ...(isMens
                ? {
                    isInMensTournament: true,
                    mensSeed: seedInfo.seed,
                    mensRegion: group.name,
                    mensEspnId: team.id,
                  }
                : {
                    isInWomensTournament: true,
                    womensSeed: seedInfo.seed,
                    womensRegion: group.name,
                    womensEspnId: team.id,
                  }),
            },
          });
          updated++;
        } else {
          await db.school.create({
            data: {
              seasonId,
              name: team.displayName,
              shortName: details?.shortDisplayName ?? null,
              abbreviation: details?.abbreviation ?? null,
              isInMensTournament: isMens,
              isInWomensTournament: !isMens,
              mensSeed: isMens ? seedInfo.seed : null,
              womensSeed: !isMens ? seedInfo.seed : null,
              mensRegion: isMens ? group.name : null,
              womensRegion: !isMens ? group.name : null,
              mensEspnId: isMens ? team.id : null,
              womensEspnId: !isMens ? team.id : null,
            },
          });
          created++;
        }
      }
    }
  }

  console.log(
    `[import] importSchools(${gender}): ${created} created, ${updated} updated`
  );
  return { created, updated };
}

// ─── importBracketSlots ───────────────────────────────────────────────────────

/**
 * Describes a pending bracket slot before it is written to the DB.
 * `nextSlotKey` is resolved to a real `nextSlotId` in the second pass.
 */
type SlotSpec = {
  round: string;
  slotIndex: number;
  region: string | null;
  seed: number | null;
  schoolEspnId: string | null;
  espnEventId: string | null;
  /** The (round, slotIndex) of the slot this winner advances into. Null = championship. */
  nextSlotKey: { round: string; slotIndex: number } | null;
};

function getLeafSlotIndex(regionIdx: number, seed: number): number {
  return 100 + regionIdx * 16 + (SEED_BRACKET_POS[seed] ?? seed - 1);
}

function getFFLeafSlotIndex(ffIdx: number, teamOffset: 0 | 1): number {
  return 50 + ffIdx * 2 + teamOffset;
}

/**
 * Try to find the ESPN event ID for a game by matching team IDs within a
 * set of bracket round games.
 */
function findEventId(
  games: EspnTournamentGame[],
  teamIdA: string,
  teamIdB: string
): string | null {
  for (const game of games) {
    const ids = game.competitors.map((c) => c.team.id);
    if (ids.includes(teamIdA) && ids.includes(teamIdB)) return game.id;
  }
  return null;
}

/**
 * Builds and upserts all BracketSlot rows for the given season and gender.
 *
 * Two-pass approach:
 *  1. Upsert all slots (without nextSlotId).
 *  2. Resolve and set nextSlotId for each slot.
 *
 * This function is idempotent — calling it multiple times only updates
 * espnEventId values as ESPN populates game IDs closer to and during the
 * tournament.
 */
export async function importBracketSlots(
  seasonId: string,
  gender: keyof typeof ESPN_PATHS,
  espnTournamentId: string
): Promise<{ created: number; updated: number }> {
  const path = ESPN_PATHS[gender];
  const prismaGender = gender === "MENS" ? ("MENS" as const) : ("WOMENS" as const);

  const tournament = await fetchEspnJson<EspnTournamentResponse>(
    `${ESPN_BASE}/${path}/tournaments/${espnTournamentId}`
  );

  if (!tournament.groups || tournament.groups.length === 0) {
    throw new Error(
      `[import] ESPN tournament ${espnTournamentId} returned no groups — bracket may not be available yet`
    );
  }

  // Sort regions by ESPN order for consistent slot index assignment
  const regions = [...tournament.groups].sort((a, b) => a.order - b.order);

  // Build map: espnTeamId → DB school id
  const schools = await db.school.findMany({
    where: {
      seasonId,
      ...(gender === "MENS" ? { isInMensTournament: true } : { isInWomensTournament: true }),
    },
    select: { id: true, mensEspnId: true, womensEspnId: true },
  });
  const espnIdToSchoolId = new Map<string, string>();
  for (const s of schools) {
    const eid = gender === "MENS" ? s.mensEspnId : s.womensEspnId;
    if (eid) espnIdToSchoolId.set(eid, s.id);
  }

  // Flatten bracket rounds for event ID lookup
  const bracketRounds = tournament.bracket?.rounds ?? [];
  // Also check per-group rounds
  for (const group of regions) {
    for (const gr of group.rounds ?? []) {
      if (gr.games) {
        const existing = bracketRounds.find((r) => r.number === gr.number);
        if (!existing) {
          bracketRounds.push(gr as (typeof bracketRounds)[0]);
        }
      }
    }
  }

  const getRoundGames = (roundNum: number): EspnTournamentGame[] =>
    bracketRounds.find((r) => r.number === roundNum)?.games ?? [];

  // ── Identify First Four games ──────────────────────────────────────────────

  type FirstFourGame = {
    ffIdx: number;
    regionName: string;
    regionIdx: number;
    seed: number;
    teamAEspnId: string;
    teamBEspnId: string;
    espnEventId: string | null;
  };

  const firstFourGames: FirstFourGame[] = [];
  const ffBracketGames = getRoundGames(1); // ESPN round 1 = First Four

  for (let rIdx = 0; rIdx < regions.length; rIdx++) {
    const region = regions[rIdx];
    for (const seedInfo of region.seeds ?? []) {
      if (seedInfo.teams.length >= 2) {
        const teamA = seedInfo.teams[0];
        const teamB = seedInfo.teams[1];
        if (!teamA?.id || !teamB?.id) continue;

        const espnEventId = findEventId(ffBracketGames, teamA.id, teamB.id);
        firstFourGames.push({
          ffIdx: firstFourGames.length,
          regionName: region.name,
          regionIdx: rIdx,
          seed: seedInfo.seed,
          teamAEspnId: teamA.id,
          teamBEspnId: teamB.id,
          espnEventId,
        });
      }
    }
  }

  // ── Build slot specs ───────────────────────────────────────────────────────

  const slots: SlotSpec[] = [];

  // First Four leaf + game slots
  for (const ff of firstFourGames) {
    slots.push({
      round: "FIRST_FOUR",
      slotIndex: getFFLeafSlotIndex(ff.ffIdx, 0),
      region: ff.regionName,
      seed: ff.seed,
      schoolEspnId: ff.teamAEspnId,
      espnEventId: null,
      nextSlotKey: { round: "FIRST_FOUR", slotIndex: ff.ffIdx },
    });
    slots.push({
      round: "FIRST_FOUR",
      slotIndex: getFFLeafSlotIndex(ff.ffIdx, 1),
      region: ff.regionName,
      seed: ff.seed,
      schoolEspnId: ff.teamBEspnId,
      espnEventId: null,
      nextSlotKey: { round: "FIRST_FOUR", slotIndex: ff.ffIdx },
    });
    // Game slot — nextSlotKey will be patched below to point at the R64 game
    slots.push({
      round: "FIRST_FOUR",
      slotIndex: ff.ffIdx,
      region: ff.regionName,
      seed: ff.seed,
      schoolEspnId: null,
      espnEventId: ff.espnEventId,
      nextSlotKey: null, // patched when building R64 game slots
    });
  }

  // Round of 64 game slots and direct-seed leaf slots
  const r64BracketGames = getRoundGames(2); // ESPN round 2 = First Round (our R64)

  for (let rIdx = 0; rIdx < regions.length; rIdx++) {
    const region = regions[rIdx];

    // Build map: seed → espnTeamId for direct (non-First-Four) seeds in this region
    const seedToEspnId = new Map<number, string>();
    for (const seedInfo of region.seeds ?? []) {
      if (seedInfo.teams.length === 1 && seedInfo.teams[0]?.id) {
        seedToEspnId.set(seedInfo.seed, seedInfo.teams[0].id);
      }
    }

    for (let mIdx = 0; mIdx < SEED_MATCHUPS.length; mIdx++) {
      const [highSeed, lowSeed] = SEED_MATCHUPS[mIdx];
      const gameSlotIdx = rIdx * 8 + mIdx;

      const ffForHigh = firstFourGames.find(
        (ff) => ff.regionName === region.name && ff.seed === highSeed
      );
      const ffForLow = firstFourGames.find(
        (ff) => ff.regionName === region.name && ff.seed === lowSeed
      );

      // High-seed feeder
      if (!ffForHigh) {
        const espnId = seedToEspnId.get(highSeed) ?? null;
        slots.push({
          round: "ROUND_OF_64",
          slotIndex: getLeafSlotIndex(rIdx, highSeed),
          region: region.name,
          seed: highSeed,
          schoolEspnId: espnId,
          espnEventId: null,
          nextSlotKey: { round: "ROUND_OF_64", slotIndex: gameSlotIdx },
        });
      } else {
        // Patch the First Four game slot's nextSlotKey
        const ffGameSpec = slots.find(
          (s) => s.round === "FIRST_FOUR" && s.slotIndex === ffForHigh.ffIdx
        );
        if (ffGameSpec) {
          ffGameSpec.nextSlotKey = { round: "ROUND_OF_64", slotIndex: gameSlotIdx };
        }
      }

      // Low-seed feeder
      if (!ffForLow) {
        const espnId = seedToEspnId.get(lowSeed) ?? null;
        slots.push({
          round: "ROUND_OF_64",
          slotIndex: getLeafSlotIndex(rIdx, lowSeed),
          region: region.name,
          seed: lowSeed,
          schoolEspnId: espnId,
          espnEventId: null,
          nextSlotKey: { round: "ROUND_OF_64", slotIndex: gameSlotIdx },
        });
      } else {
        const ffGameSpec = slots.find(
          (s) => s.round === "FIRST_FOUR" && s.slotIndex === ffForLow.ffIdx
        );
        if (ffGameSpec) {
          ffGameSpec.nextSlotKey = { round: "ROUND_OF_64", slotIndex: gameSlotIdx };
        }
      }

      // Determine espnEventId for this R64 game
      const highTeamId = ffForHigh ? null : (seedToEspnId.get(highSeed) ?? null);
      const lowTeamId = ffForLow ? null : (seedToEspnId.get(lowSeed) ?? null);
      const r64EventId =
        highTeamId && lowTeamId
          ? (findEventId(r64BracketGames, highTeamId, lowTeamId) ?? null)
          : null;

      slots.push({
        round: "ROUND_OF_64",
        slotIndex: gameSlotIdx,
        region: region.name,
        seed: null,
        schoolEspnId: null,
        espnEventId: r64EventId,
        nextSlotKey: {
          round: "ROUND_OF_32",
          slotIndex: rIdx * 4 + Math.floor(mIdx / 2),
        },
      });
    }
  }

  // Round of 32 game slots
  const r32BracketGames = getRoundGames(3);
  for (let rIdx = 0; rIdx < regions.length; rIdx++) {
    for (let pos = 0; pos < 4; pos++) {
      const slotIdx = rIdx * 4 + pos;
      // Try to determine event ID from the next-round game tree
      const eventId = r32BracketGames[slotIdx]?.id ?? null;
      slots.push({
        round: "ROUND_OF_32",
        slotIndex: slotIdx,
        region: regions[rIdx].name,
        seed: null,
        schoolEspnId: null,
        espnEventId: eventId,
        nextSlotKey: { round: "SWEET_16", slotIndex: rIdx * 2 + Math.floor(pos / 2) },
      });
    }
  }

  // Sweet 16 game slots
  const s16BracketGames = getRoundGames(4);
  for (let rIdx = 0; rIdx < regions.length; rIdx++) {
    for (let pos = 0; pos < 2; pos++) {
      const slotIdx = rIdx * 2 + pos;
      const eventId = s16BracketGames[slotIdx]?.id ?? null;
      slots.push({
        round: "SWEET_16",
        slotIndex: slotIdx,
        region: regions[rIdx].name,
        seed: null,
        schoolEspnId: null,
        espnEventId: eventId,
        nextSlotKey: { round: "ELITE_8", slotIndex: rIdx },
      });
    }
  }

  // Elite 8 game slots
  const e8BracketGames = getRoundGames(5);
  for (let rIdx = 0; rIdx < regions.length; rIdx++) {
    const eventId = e8BracketGames[rIdx]?.id ?? null;
    // Default Final Four pairing: groups 0+1 meet in game 0, groups 2+3 in game 1
    const ffGameIdx = rIdx < 2 ? 0 : 1;
    slots.push({
      round: "ELITE_8",
      slotIndex: rIdx,
      region: regions[rIdx].name,
      seed: null,
      schoolEspnId: null,
      espnEventId: eventId,
      nextSlotKey: { round: "FINAL_FOUR", slotIndex: ffGameIdx },
    });
  }

  // Final Four game slots (2)
  const ffBracketGamesRound6 = getRoundGames(6);
  for (let pos = 0; pos < 2; pos++) {
    const eventId = ffBracketGamesRound6[pos]?.id ?? null;
    slots.push({
      round: "FINAL_FOUR",
      slotIndex: pos,
      region: null,
      seed: null,
      schoolEspnId: null,
      espnEventId: eventId,
      nextSlotKey: { round: "CHAMPIONSHIP", slotIndex: 0 },
    });
  }

  // Championship game slot
  const champGames = getRoundGames(7);
  slots.push({
    round: "CHAMPIONSHIP",
    slotIndex: 0,
    region: null,
    seed: null,
    schoolEspnId: null,
    espnEventId: champGames[0]?.id ?? null,
    nextSlotKey: null,
  });

  // ── Phase 1: Upsert all slots (without nextSlotId) ─────────────────────────

  let created = 0;
  let updated = 0;

  for (const spec of slots) {
    const schoolId = spec.schoolEspnId ? (espnIdToSchoolId.get(spec.schoolEspnId) ?? null) : null;
    const data = {
      seasonId,
      gender: prismaGender,
      round: spec.round as Parameters<typeof db.bracketSlot.upsert>[0]["create"]["round"],
      slotIndex: spec.slotIndex,
      region: spec.region,
      seed: spec.seed,
      schoolId,
      espnEventId: spec.espnEventId,
    };

    const existing = await db.bracketSlot.findUnique({
      where: {
        seasonId_gender_round_slotIndex: {
          seasonId,
          gender: prismaGender,
          round: data.round,
          slotIndex: spec.slotIndex,
        },
      },
      select: { id: true },
    });

    if (existing) {
      await db.bracketSlot.update({
        where: { id: existing.id },
        data: {
          schoolId,
          espnEventId: spec.espnEventId ?? undefined,
        },
      });
      updated++;
    } else {
      await db.bracketSlot.create({ data });
      created++;
    }
  }

  // ── Phase 2: Resolve nextSlotId ────────────────────────────────────────────

  for (const spec of slots) {
    if (!spec.nextSlotKey) continue;

    const thisSlot = await db.bracketSlot.findUnique({
      where: {
        seasonId_gender_round_slotIndex: {
          seasonId,
          gender: prismaGender,
          round: spec.round as Parameters<typeof db.bracketSlot.upsert>[0]["create"]["round"],
          slotIndex: spec.slotIndex,
        },
      },
      select: { id: true, nextSlotId: true },
    });

    const nextSlot = await db.bracketSlot.findUnique({
      where: {
        seasonId_gender_round_slotIndex: {
          seasonId,
          gender: prismaGender,
          round: spec.nextSlotKey
            .round as Parameters<typeof db.bracketSlot.upsert>[0]["create"]["round"],
          slotIndex: spec.nextSlotKey.slotIndex,
        },
      },
      select: { id: true },
    });

    if (thisSlot && nextSlot && thisSlot.nextSlotId !== nextSlot.id) {
      await db.bracketSlot.update({
        where: { id: thisSlot.id },
        data: { nextSlotId: nextSlot.id },
      });
    }
  }

  console.log(
    `[import] importBracketSlots(${gender}): ${created} created, ${updated} updated`
  );
  return { created, updated };
}

// ─── importResults ────────────────────────────────────────────────────────────

/**
 * Fetches completed NCAA Tournament games from the ESPN scoreboard and
 * upserts TournamentResult rows.
 *
 * Matching strategy: look up BracketSlot by espnEventId.
 * If a slot has no espnEventId yet (e.g. later-round games not yet scheduled),
 * that result is skipped — it will be picked up on the next import run after
 * importBracketSlots has been called again to populate the event ID.
 *
 * Returns counts of created and updated rows.
 */
export async function importResults(
  seasonId: string,
  gender: keyof typeof ESPN_PATHS
): Promise<{ created: number; updated: number }> {
  const path = ESPN_PATHS[gender];
  const groupId = ESPN_TOURNAMENT_GROUP_IDS[gender];
  const prismaGender = gender === "MENS" ? ("MENS" as const) : ("WOMENS" as const);

  // Determine the date range to query
  const season = await db.tournamentSeason.findUnique({
    where: { id: seasonId },
    select: { firstFourLockAt: true },
  });
  if (!season) {
    console.warn(`[import] importResults: season ${seasonId} not found`);
    return { created: 0, updated: 0 };
  }

  // Gather all dates from First Four start through today
  const dates = buildDateRange(season.firstFourLockAt, new Date());

  // Build lookup: espnTeamId → school id
  const schools = await db.school.findMany({
    where: {
      seasonId,
      ...(gender === "MENS" ? { isInMensTournament: true } : { isInWomensTournament: true }),
    },
    select: { id: true, mensEspnId: true, womensEspnId: true },
  });
  const espnIdToSchoolId = new Map<string, string>();
  for (const s of schools) {
    const eid = gender === "MENS" ? s.mensEspnId : s.womensEspnId;
    if (eid) espnIdToSchoolId.set(eid, s.id);
  }

  let created = 0;
  let updated = 0;

  for (const date of dates) {
    const url = `${ESPN_BASE}/${path}/scoreboard?groups=${groupId}&limit=100&dates=${date}`;
    let data: EspnScoreboardResponse;
    try {
      data = await fetchEspnJson<EspnScoreboardResponse>(url);
    } catch (err) {
      console.warn(`[import] Scoreboard fetch failed for ${date}:`, err);
      continue;
    }

    for (const event of data.events ?? []) {
      const competition = event.competitions?.[0];
      if (!competition?.status.type.completed) continue;

      // Find bracket slot by espnEventId
      let bracketSlot: { id: string } | null = null;
      try {
        bracketSlot = await db.bracketSlot.findUnique({
          where: { espnEventId: event.id },
          select: { id: true },
        });
      } catch {
        // espnEventId not found — slot may not be imported yet
      }

      if (!bracketSlot) {
        console.warn(
          `[import] No bracket slot found for ESPN event ${event.id} — run importBracketSlots first`
        );
        continue;
      }

      const winner = competition.competitors.find((c) => c.winner === true);
      const loser = competition.competitors.find((c) => c.winner === false);

      if (!winner || !loser) {
        console.warn(`[import] Game ${event.id} has no clear winner/loser — skipping`);
        continue;
      }

      const winningSchoolId = espnIdToSchoolId.get(winner.team.id);
      const losingSchoolId = espnIdToSchoolId.get(loser.team.id);

      if (!winningSchoolId || !losingSchoolId) {
        console.warn(
          `[import] School not found for ESPN IDs ${winner.team.id}/${loser.team.id} — run importSchools first`
        );
        continue;
      }

      const playedAt = new Date(event.date);

      // Upsert tournament result
      const existing = await db.tournamentResult.findUnique({
        where: { espnGameId: event.id },
        select: { id: true },
      });

      if (existing) {
        await db.tournamentResult.update({
          where: { id: existing.id },
          data: { winningSchoolId, losingSchoolId, playedAt, importedAt: new Date() },
        });
        updated++;
      } else {
        // Check if a result already exists for this bracket slot (different game ID — shouldn't happen)
        const slotConflict = await db.tournamentResult.findUnique({
          where: { bracketSlotId: bracketSlot.id },
          select: { id: true },
        });
        if (slotConflict) {
          // Update it with the latest data
          await db.tournamentResult.update({
            where: { id: slotConflict.id },
            data: { winningSchoolId, losingSchoolId, playedAt, importedAt: new Date() },
          });
          updated++;
        } else {
          await db.tournamentResult.create({
            data: {
              seasonId,
              bracketSlotId: bracketSlot.id,
              winningSchoolId,
              losingSchoolId,
              espnGameId: event.id,
              playedAt,
            },
          });
          created++;
        }
      }
    }
  }

  // Ensure bracket slots have the correct gender filter applied
  // (scoreboard returns all tournament games, we only want the correct gender)
  const bracketSlotIds = await db.bracketSlot.findMany({
    where: { seasonId, gender: prismaGender },
    select: { id: true },
  });
  const validSlotIds = new Set(bracketSlotIds.map((s) => s.id));

  // Remove any results that were incorrectly attributed to the wrong gender's slots
  const allResults = await db.tournamentResult.findMany({
    where: { seasonId },
    select: { id: true, bracketSlotId: true },
  });
  for (const result of allResults) {
    if (!validSlotIds.has(result.bracketSlotId)) {
      // This result belongs to the other gender — skip (don't delete, it's valid for that gender)
    }
  }

  console.log(
    `[import] importResults(${gender}): ${created} created, ${updated} updated`
  );
  return { created, updated };
}

// ─── runFullImport ────────────────────────────────────────────────────────────

export type ImportResult = {
  success: boolean;
  schoolsUpserted: number;
  bracketSlotsUpserted: number;
  resultsUpserted: number;
  error?: string;
  mensDiscoveredTournamentId?: string | null;
  womensDiscoveredTournamentId?: string | null;
};

/**
 * Orchestrates a full import for both genders:
 *   1. Auto-discover ESPN tournament IDs (if not already set on the season)
 *   2. Import schools (Men's + Women's)
 *   3. Import bracket slots (Men's + Women's)
 *   4. Import results from scoreboard (Men's + Women's)
 *   5. Write an ImportLog row
 *   6. TODO(0.6.0): trigger score recomputation
 *
 * Returns an ImportResult summary.
 */
export async function runFullImport(seasonId: string): Promise<ImportResult> {
  const startedAt = new Date();
  let schoolsUpserted = 0;
  let bracketSlotsUpserted = 0;
  let resultsUpserted = 0;

  try {
    // Load the active season to get (or discover) ESPN tournament IDs
    const season = await db.tournamentSeason.findUnique({
      where: { id: seasonId },
      select: {
        id: true,
        mensEspnTournamentId: true,
        womensEspnTournamentId: true,
      },
    });
    if (!season) throw new Error(`Season ${seasonId} not found`);

    let mensId = season.mensEspnTournamentId;
    let womensId = season.womensEspnTournamentId;

    // Auto-discover if not already set
    if (!mensId) {
      console.log("[import] Men's tournament ID not set — attempting auto-discovery…");
      mensId = await discoverTournamentId("MENS");
      if (mensId) {
        await db.tournamentSeason.update({
          where: { id: seasonId },
          data: { mensEspnTournamentId: mensId },
        });
        console.log(`[import] Discovered Men's tournament ID: ${mensId}`);
      } else {
        console.warn("[import] Could not auto-discover Men's tournament ID.");
      }
    }

    if (!womensId) {
      console.log("[import] Women's tournament ID not set — attempting auto-discovery…");
      womensId = await discoverTournamentId("WOMENS");
      if (womensId) {
        await db.tournamentSeason.update({
          where: { id: seasonId },
          data: { womensEspnTournamentId: womensId },
        });
        console.log(`[import] Discovered Women's tournament ID: ${womensId}`);
      } else {
        console.warn("[import] Could not auto-discover Women's tournament ID.");
      }
    }

    // Import schools (requires tournament ID)
    if (mensId) {
      const r = await importSchools(seasonId, "MENS", mensId);
      schoolsUpserted += r.created + r.updated;
    }
    if (womensId) {
      const r = await importSchools(seasonId, "WOMENS", womensId);
      schoolsUpserted += r.created + r.updated;
    }

    // Import bracket slots (requires tournament ID)
    if (mensId) {
      const r = await importBracketSlots(seasonId, "MENS", mensId);
      bracketSlotsUpserted += r.created + r.updated;
    }
    if (womensId) {
      const r = await importBracketSlots(seasonId, "WOMENS", womensId);
      bracketSlotsUpserted += r.created + r.updated;
    }

    // Import results from scoreboard (no tournament ID needed — uses group IDs)
    {
      const r = await importResults(seasonId, "MENS");
      resultsUpserted += r.created + r.updated;
    }
    {
      const r = await importResults(seasonId, "WOMENS");
      resultsUpserted += r.created + r.updated;
    }

    // TODO(0.6.0): trigger score recomputation
    await recomputeAllScores(seasonId);

    // Write success log
    await db.importLog.create({
      data: {
        seasonId,
        status: "SUCCESS",
        schoolsUpserted,
        bracketSlotsUpserted,
        resultsUpserted,
        startedAt,
        completedAt: new Date(),
      },
    });

    return {
      success: true,
      schoolsUpserted,
      bracketSlotsUpserted,
      resultsUpserted,
      mensDiscoveredTournamentId: mensId,
      womensDiscoveredTournamentId: womensId,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[import] runFullImport failed:", errorMessage);

    // Write failure log
    await db.importLog.create({
      data: {
        seasonId,
        status: "FAILURE",
        schoolsUpserted,
        bracketSlotsUpserted,
        resultsUpserted,
        errorMessage,
        startedAt,
        completedAt: new Date(),
      },
    });

    return {
      success: false,
      schoolsUpserted,
      bracketSlotsUpserted,
      resultsUpserted,
      error: errorMessage,
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns an array of YYYYMMDD date strings from startDate through endDate (inclusive). */
function buildDateRange(startDate: Date, endDate: Date): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  current.setUTCHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setUTCHours(0, 0, 0, 0);

  while (current <= end) {
    const y = current.getUTCFullYear();
    const m = String(current.getUTCMonth() + 1).padStart(2, "0");
    const d = String(current.getUTCDate()).padStart(2, "0");
    dates.push(`${y}${m}${d}`);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

