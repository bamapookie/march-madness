import type { LockMode } from "@/generated/prisma/client";

type SeedFields = { mensSeed: number | null; womensSeed: number | null };
type NamedSeedFields = SeedFields & { name: string };

/**
 * Compute the average NCAA seed for pre-population sort.
 * Schools in both tournaments: average of both seeds.
 * Schools in one tournament only: that seed directly.
 * Schools with no seeds are pushed to the bottom (returns 99).
 */
export function getAverageSeed(school: SeedFields): number {
  const seeds: number[] = [];
  if (school.mensSeed !== null && school.mensSeed !== undefined) seeds.push(school.mensSeed);
  if (school.womensSeed !== null && school.womensSeed !== undefined) seeds.push(school.womensSeed);
  if (seeds.length === 0) return 99;
  return seeds.reduce((sum, s) => sum + s, 0) / seeds.length;
}

/**
 * Sort schools ascending by average seed, then alphabetically by name for ties.
 * Returns a new array — does not mutate the input.
 */
export function sortSchoolsByDefaultRank<T extends NamedSeedFields>(schools: T[]): T[] {
  return [...schools].sort((a, b) => {
    const avgA = getAverageSeed(a);
    const avgB = getAverageSeed(b);
    if (avgA !== avgB) return avgA - avgB;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Return the applicable lock timestamp for a given lock mode.
 */
export function getLockAt(
  season: { firstFourLockAt: Date; roundOf64LockAt: Date },
  lockMode: LockMode
): Date {
  return lockMode === "BEFORE_FIRST_FOUR" ? season.firstFourLockAt : season.roundOf64LockAt;
}

/**
 * Return true if a ranking list is currently locked for edits.
 */
export function isRankingListLocked(
  season: { firstFourLockAt: Date; roundOf64LockAt: Date },
  lockMode: LockMode
): boolean {
  return new Date() >= getLockAt(season, lockMode);
}
