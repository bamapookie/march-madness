/*
  Warnings:

  - A unique constraint covering the columns `[joinCode]` on the table `competitions` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `joinCode` to the `competitions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "competitions" ADD COLUMN     "joinCode" TEXT NOT NULL,
ADD COLUMN     "joinCutoffAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "competitions_joinCode_key" ON "competitions"("joinCode");
