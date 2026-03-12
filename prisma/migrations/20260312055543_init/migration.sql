-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MENS', 'WOMENS');

-- CreateEnum
CREATE TYPE "Round" AS ENUM ('FIRST_FOUR', 'ROUND_OF_64', 'ROUND_OF_32', 'SWEET_16', 'ELITE_8', 'FINAL_FOUR', 'CHAMPIONSHIP');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "tournament_seasons" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "firstFourLockAt" TIMESTAMP(3) NOT NULL,
    "roundOf64LockAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournament_seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schools" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "abbreviation" TEXT,
    "isInMensTournament" BOOLEAN NOT NULL DEFAULT false,
    "isInWomensTournament" BOOLEAN NOT NULL DEFAULT false,
    "mensSeed" INTEGER,
    "womensSeed" INTEGER,
    "mensRegion" TEXT,
    "womensRegion" TEXT,
    "mensEspnId" TEXT,
    "womensEspnId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bracket_slots" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "round" "Round" NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "region" TEXT,
    "seed" INTEGER,
    "schoolId" TEXT,
    "nextSlotId" TEXT,

    CONSTRAINT "bracket_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ranking_lists" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ranking_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ranking_entries" (
    "id" TEXT NOT NULL,
    "rankingListId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ranking_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitions" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "settingsJson" JSONB NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competition_members" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competition_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competition_entries" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rankingListId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competition_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_results" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "bracketSlotId" TEXT NOT NULL,
    "winningSchoolId" TEXT NOT NULL,
    "losingSchoolId" TEXT NOT NULL,
    "espnGameId" TEXT NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "maxUses" INTEGER,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resolved_brackets" (
    "id" TEXT NOT NULL,
    "competitionEntryId" TEXT NOT NULL,
    "mensJson" JSONB NOT NULL,
    "womensJson" JSONB NOT NULL,
    "resolvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resolved_brackets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entry_scores" (
    "id" TEXT NOT NULL,
    "competitionEntryId" TEXT NOT NULL,
    "mensScore" INTEGER NOT NULL DEFAULT 0,
    "womensScore" INTEGER NOT NULL DEFAULT 0,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "tiebreaker" INTEGER NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entry_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_seasons_name_key" ON "tournament_seasons"("name");

-- CreateIndex
CREATE INDEX "schools_seasonId_idx" ON "schools"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "schools_seasonId_name_key" ON "schools"("seasonId", "name");

-- CreateIndex
CREATE INDEX "bracket_slots_seasonId_gender_idx" ON "bracket_slots"("seasonId", "gender");

-- CreateIndex
CREATE UNIQUE INDEX "bracket_slots_seasonId_gender_round_slotIndex_key" ON "bracket_slots"("seasonId", "gender", "round", "slotIndex");

-- CreateIndex
CREATE INDEX "ranking_lists_userId_seasonId_idx" ON "ranking_lists"("userId", "seasonId");

-- CreateIndex
CREATE INDEX "ranking_entries_rankingListId_idx" ON "ranking_entries"("rankingListId");

-- CreateIndex
CREATE UNIQUE INDEX "ranking_entries_rankingListId_schoolId_key" ON "ranking_entries"("rankingListId", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "ranking_entries_rankingListId_rank_key" ON "ranking_entries"("rankingListId", "rank");

-- CreateIndex
CREATE INDEX "competitions_seasonId_idx" ON "competitions"("seasonId");

-- CreateIndex
CREATE INDEX "competitions_organizerId_idx" ON "competitions"("organizerId");

-- CreateIndex
CREATE UNIQUE INDEX "competition_members_competitionId_userId_key" ON "competition_members"("competitionId", "userId");

-- CreateIndex
CREATE INDEX "competition_entries_competitionId_userId_idx" ON "competition_entries"("competitionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "competition_entries_competitionId_rankingListId_key" ON "competition_entries"("competitionId", "rankingListId");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_results_bracketSlotId_key" ON "tournament_results"("bracketSlotId");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_results_espnGameId_key" ON "tournament_results"("espnGameId");

-- CreateIndex
CREATE INDEX "tournament_results_seasonId_idx" ON "tournament_results"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");

-- CreateIndex
CREATE INDEX "invitations_competitionId_idx" ON "invitations"("competitionId");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "resolved_brackets_competitionEntryId_key" ON "resolved_brackets"("competitionEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "entry_scores_competitionEntryId_key" ON "entry_scores"("competitionEntryId");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schools" ADD CONSTRAINT "schools_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "tournament_seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bracket_slots" ADD CONSTRAINT "bracket_slots_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "tournament_seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bracket_slots" ADD CONSTRAINT "bracket_slots_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bracket_slots" ADD CONSTRAINT "bracket_slots_nextSlotId_fkey" FOREIGN KEY ("nextSlotId") REFERENCES "bracket_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking_lists" ADD CONSTRAINT "ranking_lists_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "tournament_seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking_lists" ADD CONSTRAINT "ranking_lists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking_entries" ADD CONSTRAINT "ranking_entries_rankingListId_fkey" FOREIGN KEY ("rankingListId") REFERENCES "ranking_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking_entries" ADD CONSTRAINT "ranking_entries_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "tournament_seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_members" ADD CONSTRAINT "competition_members_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_members" ADD CONSTRAINT "competition_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_entries" ADD CONSTRAINT "competition_entries_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_entries" ADD CONSTRAINT "competition_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_entries" ADD CONSTRAINT "competition_entries_rankingListId_fkey" FOREIGN KEY ("rankingListId") REFERENCES "ranking_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_results" ADD CONSTRAINT "tournament_results_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "tournament_seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_results" ADD CONSTRAINT "tournament_results_bracketSlotId_fkey" FOREIGN KEY ("bracketSlotId") REFERENCES "bracket_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_results" ADD CONSTRAINT "tournament_results_winningSchoolId_fkey" FOREIGN KEY ("winningSchoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_results" ADD CONSTRAINT "tournament_results_losingSchoolId_fkey" FOREIGN KEY ("losingSchoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resolved_brackets" ADD CONSTRAINT "resolved_brackets_competitionEntryId_fkey" FOREIGN KEY ("competitionEntryId") REFERENCES "competition_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entry_scores" ADD CONSTRAINT "entry_scores_competitionEntryId_fkey" FOREIGN KEY ("competitionEntryId") REFERENCES "competition_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
