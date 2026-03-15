"use client";
import { ErrorBoundaryContent } from "@/components/ui/error-boundary-content";
export default function RankingEditError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorBoundaryContent error={error} reset={reset} />;
}
