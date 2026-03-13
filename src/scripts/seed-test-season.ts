/**
 * Seed a 2026 tournament season with representative schools for local development.
 * Run with: npm run seed:test
 *
 * Schools are taken from realistic NCAA tournament fields.
 * Some schools appear in BOTH Men's and Women's tournaments.
 */
import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

// ─── School definitions ───────────────────────────────────────────────────────

type SchoolDef = {
  name: string;
  shortName?: string;
  abbreviation?: string;
  mens?: { seed: number; region: string };
  womens?: { seed: number; region: string };
};

const schools: SchoolDef[] = [
  // ── In BOTH tournaments ──────────────────────────────────────────────────
  {
    name: "Duke Blue Devils",
    shortName: "Duke",
    abbreviation: "DUKE",
    mens: { seed: 1, region: "East" },
    womens: { seed: 3, region: "Albany" },
  },
  {
    name: "UConn Huskies",
    shortName: "UConn",
    abbreviation: "CONN",
    mens: { seed: 2, region: "East" },
    womens: { seed: 1, region: "Portland" },
  },
  {
    name: "Tennessee Volunteers",
    shortName: "Tennessee",
    abbreviation: "TENN",
    mens: { seed: 2, region: "South" },
    womens: { seed: 2, region: "Greensboro" },
  },
  {
    name: "Arizona Wildcats",
    shortName: "Arizona",
    abbreviation: "ARIZ",
    mens: { seed: 4, region: "West" },
    womens: { seed: 4, region: "Spokane" },
  },
  {
    name: "Kentucky Wildcats",
    shortName: "Kentucky",
    abbreviation: "UK",
    mens: { seed: 3, region: "East" },
    womens: { seed: 5, region: "Albany" },
  },
  {
    name: "Louisville Cardinals",
    shortName: "Louisville",
    abbreviation: "LOU",
    mens: { seed: 5, region: "Midwest" },
    womens: { seed: 2, region: "Greensboro" },
  },
  {
    name: "Notre Dame Fighting Irish",
    shortName: "Notre Dame",
    abbreviation: "ND",
    mens: { seed: 6, region: "South" },
    womens: { seed: 2, region: "Albany" },
  },
  {
    name: "Stanford Cardinal",
    shortName: "Stanford",
    abbreviation: "STAN",
    mens: { seed: 7, region: "West" },
    womens: { seed: 2, region: "Spokane" },
  },

  // ── Men's only ────────────────────────────────────────────────────────────
  {
    name: "Kansas Jayhawks",
    shortName: "Kansas",
    abbreviation: "KU",
    mens: { seed: 1, region: "South" },
  },
  {
    name: "Houston Cougars",
    shortName: "Houston",
    abbreviation: "HOU",
    mens: { seed: 1, region: "East" },
  },
  {
    name: "Auburn Tigers",
    shortName: "Auburn",
    abbreviation: "AUB",
    mens: { seed: 1, region: "Midwest" },
  },
  {
    name: "Alabama Crimson Tide",
    shortName: "Alabama",
    abbreviation: "ALA",
    mens: { seed: 2, region: "Midwest" },
  },
  {
    name: "Iowa State Cyclones",
    shortName: "Iowa State",
    abbreviation: "ISU",
    mens: { seed: 2, region: "West" },
  },
  {
    name: "Gonzaga Bulldogs",
    shortName: "Gonzaga",
    abbreviation: "GONZ",
    mens: { seed: 3, region: "West" },
  },
  {
    name: "Wisconsin Badgers",
    shortName: "Wisconsin",
    abbreviation: "WIS",
    mens: { seed: 3, region: "South" },
  },
  {
    name: "Marquette Golden Eagles",
    shortName: "Marquette",
    abbreviation: "MU",
    mens: { seed: 3, region: "Midwest" },
  },
  {
    name: "Baylor Bears",
    shortName: "Baylor",
    abbreviation: "BAY",
    mens: { seed: 4, region: "South" },
  },
  {
    name: "Purdue Boilermakers",
    shortName: "Purdue",
    abbreviation: "PUR",
    mens: { seed: 4, region: "East" },
  },
  {
    name: "Michigan State Spartans",
    shortName: "Michigan State",
    abbreviation: "MSU",
    mens: { seed: 4, region: "Midwest" },
  },
  {
    name: "Texas Tech Red Raiders",
    shortName: "Texas Tech",
    abbreviation: "TTU",
    mens: { seed: 5, region: "West" },
  },
  {
    name: "Saint Mary's Gaels",
    shortName: "Saint Mary's",
    abbreviation: "SMC",
    mens: { seed: 5, region: "South" },
  },
  {
    name: "Memphis Tigers",
    shortName: "Memphis",
    abbreviation: "MEM",
    mens: { seed: 5, region: "East" },
  },
  { name: "BYU Cougars", shortName: "BYU", abbreviation: "BYU", mens: { seed: 6, region: "West" } },
  {
    name: "Illinois Fighting Illini",
    shortName: "Illinois",
    abbreviation: "ILL",
    mens: { seed: 6, region: "Midwest" },
  },
  {
    name: "Creighton Bluejays",
    shortName: "Creighton",
    abbreviation: "CREI",
    mens: { seed: 6, region: "East" },
  },
  {
    name: "UCLA Bruins",
    shortName: "UCLA",
    abbreviation: "UCLA",
    mens: { seed: 7, region: "South" },
  },
  {
    name: "Missouri Tigers",
    shortName: "Missouri",
    abbreviation: "MIZ",
    mens: { seed: 7, region: "Midwest" },
  },
  {
    name: "Villanova Wildcats",
    shortName: "Villanova",
    abbreviation: "NOVA",
    mens: { seed: 7, region: "East" },
  },
  {
    name: "Mississippi State Bulldogs",
    shortName: "Mississippi State",
    abbreviation: "MSU2",
    mens: { seed: 8, region: "West" },
  },
  {
    name: "San Diego State Aztecs",
    shortName: "San Diego St",
    abbreviation: "SDSU",
    mens: { seed: 8, region: "South" },
  },
  {
    name: "Northwestern Wildcats",
    shortName: "Northwestern",
    abbreviation: "NW",
    mens: { seed: 8, region: "Midwest" },
  },
  { name: "FAU Owls", shortName: "FAU", abbreviation: "FAU", mens: { seed: 9, region: "East" } },
  {
    name: "TCU Horned Frogs",
    shortName: "TCU",
    abbreviation: "TCU",
    mens: { seed: 9, region: "West" },
  },
  {
    name: "Drake Bulldogs",
    shortName: "Drake",
    abbreviation: "DRKE",
    mens: { seed: 9, region: "South" },
  },
  {
    name: "Penn State Nittany Lions",
    shortName: "Penn State",
    abbreviation: "PSU",
    mens: { seed: 9, region: "Midwest" },
  },

  // ── Women's only ─────────────────────────────────────────────────────────
  {
    name: "South Carolina Gamecocks",
    shortName: "South Carolina",
    abbreviation: "SC",
    womens: { seed: 1, region: "Albany" },
  },
  {
    name: "Texas Longhorns",
    shortName: "Texas",
    abbreviation: "TEX",
    womens: { seed: 1, region: "Spokane" },
  },
  {
    name: "UCLA Bruins Women",
    shortName: "UCLA Women",
    abbreviation: "UCLAW",
    womens: { seed: 1, region: "Greensboro" },
  },
  {
    name: "LSU Tigers",
    shortName: "LSU",
    abbreviation: "LSU",
    womens: { seed: 1, region: "Portland" },
  },
  {
    name: "Ohio State Buckeyes",
    shortName: "Ohio State",
    abbreviation: "OSU",
    womens: { seed: 3, region: "Portland" },
  },
  {
    name: "Indiana Hoosiers",
    shortName: "Indiana",
    abbreviation: "IND",
    womens: { seed: 3, region: "Spokane" },
  },
  {
    name: "NC State Wolfpack",
    shortName: "NC State",
    abbreviation: "NCST",
    womens: { seed: 4, region: "Albany" },
  },
  {
    name: "Oregon Ducks",
    shortName: "Oregon",
    abbreviation: "ORE",
    womens: { seed: 4, region: "Portland" },
  },
  {
    name: "Creighton Bluejays Women",
    shortName: "Creighton W",
    abbreviation: "CREIW",
    womens: { seed: 4, region: "Greensboro" },
  },
  {
    name: "Colorado Buffaloes",
    shortName: "Colorado",
    abbreviation: "COLO",
    womens: { seed: 5, region: "Spokane" },
  },
  {
    name: "Oklahoma Sooners",
    shortName: "Oklahoma",
    abbreviation: "OU",
    womens: { seed: 5, region: "Albany" },
  },
  {
    name: "Virginia Tech Hokies",
    shortName: "Virginia Tech",
    abbreviation: "VT",
    womens: { seed: 5, region: "Portland" },
  },
  {
    name: "Ole Miss Rebels",
    shortName: "Ole Miss",
    abbreviation: "MISS",
    womens: { seed: 6, region: "Greensboro" },
  },
  {
    name: "UCLA Bruins W2",
    shortName: "UCLA W2",
    abbreviation: "UCLA2",
    womens: { seed: 6, region: "Spokane" },
  },
  {
    name: "Iowa Hawkeyes",
    shortName: "Iowa",
    abbreviation: "IOWA",
    womens: { seed: 7, region: "Albany" },
  },
  {
    name: "Missouri Tigers Women",
    shortName: "Missouri W",
    abbreviation: "MIZW",
    womens: { seed: 7, region: "Portland" },
  },
  {
    name: "Georgia Bulldogs",
    shortName: "Georgia",
    abbreviation: "UGA",
    womens: { seed: 8, region: "Spokane" },
  },
  {
    name: "Arkansas Razorbacks",
    shortName: "Arkansas",
    abbreviation: "ARK",
    womens: { seed: 8, region: "Albany" },
  },
];

// ─── Seed function ────────────────────────────────────────────────────────────

async function seed() {
  console.log("🌱  Seeding 2026 tournament season…");

  // 1. Upsert season
  const season = await db.tournamentSeason.upsert({
    where: { name: "2026" },
    update: {
      firstFourLockAt: new Date("2026-03-19T12:00:00Z"),
      roundOf64LockAt: new Date("2026-03-20T11:00:00Z"),
      isActive: true,
    },
    create: {
      name: "2026",
      firstFourLockAt: new Date("2026-03-19T12:00:00Z"),
      roundOf64LockAt: new Date("2026-03-20T11:00:00Z"),
      isActive: true,
    },
  });
  console.log(`   Season: ${season.name} (id=${season.id})`);

  // 2. Upsert schools
  let created = 0;
  let updated = 0;
  for (const def of schools) {
    const data = {
      seasonId: season.id,
      name: def.name,
      shortName: def.shortName ?? null,
      abbreviation: def.abbreviation ?? null,
      isInMensTournament: !!def.mens,
      isInWomensTournament: !!def.womens,
      mensSeed: def.mens?.seed ?? null,
      womensSeed: def.womens?.seed ?? null,
      mensRegion: def.mens?.region ?? null,
      womensRegion: def.womens?.region ?? null,
    };

    const existing = await db.school.findUnique({
      where: { seasonId_name: { seasonId: season.id, name: def.name } },
    });

    if (existing) {
      await db.school.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await db.school.create({ data });
      created++;
    }
  }

  console.log(`   Schools: ${created} created, ${updated} updated (${schools.length} total)`);
  console.log("✅  Seed complete.");
  console.log(
    `\n   Start the dev server and sign in, then go to /ranking and click "New Ranking List".\n`
  );
}

seed()
  .catch((err: unknown) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => void pool.end());
