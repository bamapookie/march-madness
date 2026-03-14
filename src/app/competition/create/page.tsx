import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { CreateCompetitionForm } from "@/components/competition/create-competition-form";

export default async function CreateCompetitionPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/competition/create");

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8">
        <Link
          href="/competition"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          ← Back to Competitions
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Create Competition
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Configure your group&apos;s scoring rules, lock mode, and invite settings.
        </p>
      </div>
      <CreateCompetitionForm />
    </main>
  );
}
