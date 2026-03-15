"use client";

import { useRouter } from "next/navigation";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export function ErrorBoundaryContent({ error, reset }: Props) {
  const router = useRouter();

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center px-4 py-16 text-center">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Something went wrong
      </h2>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        An unexpected error occurred. Please try again or go back.
      </p>

      {process.env.NODE_ENV === "development" && (
        <details className="mt-4 max-w-lg text-left">
          <summary className="cursor-pointer text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500">
            Error details
          </summary>
          <pre className="mt-2 overflow-auto rounded bg-zinc-100 p-3 text-xs text-red-700 dark:bg-zinc-900 dark:text-red-400">
            {error.message}
            {error.digest ? `\nDigest: ${error.digest}` : ""}
          </pre>
        </details>
      )}

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          ← Go back
        </button>
      </div>
    </div>
  );
}
