import { auth } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Dashboard</h1>
      <p className="mt-2 text-zinc-500 dark:text-zinc-400">
        Welcome back, {session?.user.name ?? "there"}. Your competitions and ranking lists will
        appear here.
      </p>
      <p className="mt-4 text-sm text-zinc-400 dark:text-zinc-600">Coming in milestone 0.5.0</p>
    </main>
  );
}
