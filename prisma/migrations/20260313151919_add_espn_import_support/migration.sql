/*
  Warnings:

  - A unique constraint covering the columns `[espnEventId]` on the table `bracket_slots` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('SUCCESS', 'FAILURE');

-- AlterTable
ALTER TABLE "bracket_slots" ADD COLUMN     "espnEventId" TEXT;

-- AlterTable
ALTER TABLE "tournament_seasons" ADD COLUMN     "mensEspnTournamentId" TEXT,
ADD COLUMN     "womensEspnTournamentId" TEXT;

-- CreateTable
CREATE TABLE "import_logs" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL,
    "schoolsUpserted" INTEGER NOT NULL DEFAULT 0,
    "bracketSlotsUpserted" INTEGER NOT NULL DEFAULT 0,
    "resultsUpserted" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "import_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_logs_seasonId_idx" ON "import_logs"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "bracket_slots_espnEventId_key" ON "bracket_slots"("espnEventId");

-- AddForeignKey
ALTER TABLE "import_logs" ADD CONSTRAINT "import_logs_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "tournament_seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
