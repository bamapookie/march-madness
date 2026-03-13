/**
 * Manual results import script for development and testing.
 * Run with: npm run import:results
 *
 * Finds the active tournament season and runs a full import from ESPN.
 * Mirrors the behaviour of GET /api/cron/import-results without the
 * HTTP layer or secret validation.
 */
import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { runFullImport } from "../lib/import";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function main() {
  console.log("🏀  Starting ESPN results import…\n");

  const season = await db.tournamentSeason.findFirst({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      mensEspnTournamentId: true,
      womensEspnTournamentId: true,
    },
  });

  if (!season) {
    console.error("❌  No active tournament season found. Run npm run seed:test first.");
    process.exit(1);
  }

  console.log(`   Season: ${season.name} (id=${season.id})`);
  console.log(`   Men's ESPN ID:   ${season.mensEspnTournamentId ?? "(not set — will auto-discover)"}`);
  console.log(`   Women's ESPN ID: ${season.womensEspnTournamentId ?? "(not set — will auto-discover)"}`);
  console.log();

  // runFullImport uses the shared db singleton internally.
  // This script creates its own PrismaClient for the script process; the
  // import functions use the singleton from src/lib/db.ts. Both connect to
  // the same DATABASE_URL, so results are consistent.
  const result = await runFullImport(season.id);

  if (result.success) {
    console.log("\n✅  Import complete.");
    console.log(`   Schools upserted:      ${result.schoolsUpserted}`);
    console.log(`   Bracket slots upserted: ${result.bracketSlotsUpserted}`);
    console.log(`   Results upserted:       ${result.resultsUpserted}`);
    if (result.mensDiscoveredTournamentId) {
      console.log(`   Men's tournament ID discovered: ${result.mensDiscoveredTournamentId}`);
    }
    if (result.womensDiscoveredTournamentId) {
      console.log(`   Women's tournament ID discovered: ${result.womensDiscoveredTournamentId}`);
    }
  } else {
    console.error("\n❌  Import failed:", result.error);
    process.exit(1);
  }
}

main()
  .catch((err: unknown) => {
    console.error("Import script error:", err);
    process.exit(1);
  })
  .finally(() => void pool.end());

