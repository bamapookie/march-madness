/**
 * TypeScript types for ESPN API responses consumed by src/lib/import.ts.
 *
 * IMPORTANT: These types reflect the observed ESPN API shapes as of 2026.
 * All fields are typed as optional where the API does not guarantee presence.
 * No `any` types are used.
 *
 * Endpoints covered:
 *   Teams:      GET .../teams?limit=500
 *   Scoreboard: GET .../scoreboard?groups={id}&limit=100&dates=YYYYMMDD
 *   Tournament: GET .../tournaments/{tournamentId}
 */

// ─── Teams endpoint ───────────────────────────────────────────────────────────

export type EspnTeam = {
  id: string;
  displayName: string;
  shortDisplayName: string;
  abbreviation: string;
  location?: string;
  name?: string;
  color?: string;
  isActive?: boolean;
};

export type EspnTeamsResponse = {
  sports?: Array<{
    leagues?: Array<{
      teams?: Array<{
        team: EspnTeam;
      }>;
    }>;
  }>;
};

// ─── Scoreboard endpoint ──────────────────────────────────────────────────────

export type EspnScoreboardCompetitor = {
  id: string;
  uid?: string;
  team: {
    id: string;
    uid?: string;
    displayName: string;
    abbreviation?: string;
    shortDisplayName?: string;
  };
  winner?: boolean;
  score?: string;
  /** Seed rank for tournament games. */
  curatedRank?: {
    current: number;
  };
  records?: Array<{ summary: string; type: string }>;
};

export type EspnScoreboardCompetition = {
  id: string;
  competitors: EspnScoreboardCompetitor[];
  status: {
    type: {
      completed: boolean;
      state?: string;
      description?: string;
    };
    displayClock?: string;
    period?: number;
  };
  /**
   * Present on NCAA Tournament games; contains bracket placement info.
   * Field names may vary — check both `tournament` and `notes` on real data.
   */
  tournament?: {
    id?: string;
    round?: {
      number: number;
      displayName?: string;
    };
    bracketRound?: string;
    bracketRegion?: string;
    bracketGameNumber?: number;
    seed?: {
      displayName?: string;
    };
  };
  notes?: Array<{
    type?: string;
    headline?: string;
    text?: string;
  }>;
  venue?: {
    id?: string;
    fullName?: string;
    address?: {
      city?: string;
      state?: string;
    };
  };
};

export type EspnScoreboardEvent = {
  id: string;
  uid?: string;
  date: string;
  name?: string;
  shortName?: string;
  season?: {
    year?: number;
    type?: number;
    slug?: string;
  };
  competitions: EspnScoreboardCompetition[];
  links?: Array<{
    rel?: string[];
    href?: string;
    text?: string;
  }>;
};

export type EspnScoreboardResponse = {
  events?: EspnScoreboardEvent[];
  season?: {
    year?: number;
    type?: number;
    slug?: string;
  };
  leagues?: Array<{
    id?: string;
    name?: string;
    tournament?: {
      id?: string;
      title?: string;
    };
  }>;
};

// ─── Tournament bracket endpoint ──────────────────────────────────────────────
//
// GET .../tournaments/{tournamentId}
//
// Observed structure (may vary — always log raw response when debugging):
//   response.groups[] — one per region (East, West, South, Midwest / or Women's equivalents)
//     .name           — region name (e.g. "East")
//     .order          — display order (use to sort regions deterministically)
//     .seeds[]        — one per seed position (1–16)
//       .seed         — seed number (1–16)
//       .displayName  — team name or "TBD" for First Four
//       .teams[]      — one team for direct seeds; two teams for First Four play-in seeds
//         .id         — ESPN team ID
//         .displayName
//   response.bracket.rounds[] — game tree
//     .number         — round number (1=First Four, 2=First Round, 3=Second Round, …)
//     .displayName    — "First Four", "First Round", "Sweet 16", etc.
//     .games[]
//       .id           — ESPN event ID (matches scoreboard event.id)
//       .date
//       .competitors[].team.id
//       .competitors[].winner
//       .competitors[].seed.rank
//       .region.name  — region name for the game (present on regional rounds)

export type EspnTournamentTeamRef = {
  id: string;
  uid?: string;
  displayName?: string;
  shortDisplayName?: string;
  abbreviation?: string;
};

export type EspnTournamentSeed = {
  /** Seed number (1–16). */
  seed: number;
  displayName?: string;
  /**
   * One entry for a direct seed, two entries for a First Four play-in seed.
   */
  teams: EspnTournamentTeamRef[];
};

export type EspnTournamentGroup = {
  id?: string;
  /** Region name (e.g. "East", "West", "Albany", "Portland"). */
  name: string;
  abbreviation?: string;
  /** Used to sort regions into a consistent bracket order. */
  order: number;
  seeds: EspnTournamentSeed[];
  /** Some responses include per-group game trees. */
  rounds?: Array<{
    number: number;
    displayName?: string;
    games?: EspnTournamentGame[];
  }>;
};

export type EspnTournamentCompetitor = {
  id?: string;
  team: EspnTournamentTeamRef;
  winner?: boolean;
  score?: string;
  seed?: {
    rank?: number;
    displayName?: string;
  };
};

export type EspnTournamentGame = {
  id: string;
  date?: string;
  name?: string;
  competitors: EspnTournamentCompetitor[];
  /** Present on regional-round games. */
  region?: {
    name?: string;
    abbreviation?: string;
  };
  status?: {
    type?: {
      completed?: boolean;
      state?: string;
    };
  };
};

export type EspnTournamentBracket = {
  rounds: Array<{
    number: number;
    displayName?: string;
    games: EspnTournamentGame[];
  }>;
};

export type EspnTournamentResponse = {
  id: string;
  name?: string;
  displayName?: string;
  groups: EspnTournamentGroup[];
  bracket?: EspnTournamentBracket;
};

