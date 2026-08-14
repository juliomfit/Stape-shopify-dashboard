import type { Metadata } from "next";
import { BrandMark } from "@/components/dashboard/BrandMark";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string; error?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const nextPath = params.next?.startsWith("/") ? params.next : "/";

  return (
    <main className="flex min-h-full items-center justify-center bg-background p-8">
      <form
        method="post"
        action="/api/auth/login"
        className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <BrandMark size={36} />
          <h1 className="text-lg font-semibold text-foreground">Goodsnova</h1>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted">
          Enter the dashboard password.
        </p>
        {params.error ? (
          <p className="mt-3 text-sm text-red-700">Wrong password.</p>
        ) : null}
        <input type="hidden" name="next" value={nextPath} />
        <label className="mt-4 flex flex-col gap-1 text-xs text-muted">
          Password
          <input
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            type="password"
            name="password"
            autoComplete="current-password"
            required
          />
        </label>
        <button
          className="mt-4 w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white"
          type="submit"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
