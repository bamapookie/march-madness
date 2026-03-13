-- CreateEnum
CREATE TYPE "LockMode" AS ENUM ('BEFORE_FIRST_FOUR', 'BEFORE_ROUND_OF_64');

-- AlterTable
ALTER TABLE "ranking_lists" ADD COLUMN     "lockMode" "LockMode" NOT NULL DEFAULT 'BEFORE_FIRST_FOUR';
