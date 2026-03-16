"use client";
import { ErrorBoundaryContent } from "@/components/ui/error-boundary-content";
export default function LeaderboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorBoundaryContent error={error} reset={reset} />;
}
