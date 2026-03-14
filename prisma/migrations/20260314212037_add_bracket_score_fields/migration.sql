-- AlterTable
ALTER TABLE "bracket_slots" ADD COLUMN     "isInProgress" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "entry_scores" ADD COLUMN     "breakdownJson" JSONB,
ADD COLUMN     "maxPotentialRemaining" INTEGER;
