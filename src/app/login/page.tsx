import Link from "next/link";
import { redirect } from "next/navigation";
import { signInAction, signUpAction } from "@/lib/auth/actions";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const authConfigured = hasSupabaseEnv();

  if (authConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      redirect("/");
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-[32px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-6 py-7 shadow-[0_18px_60px_rgba(16,27,54,0.08)] sm:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-[color:var(--color-accent)]">
          Auth
        </p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight text-[color:var(--color-foreground)]">
          Sign in before the app stops pretending to be single-user.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[color:var(--color-muted)]">
          This slice wires Supabase SSR auth and cookie-based sessions into the
          app. Signed-in accounts now sync their vocab library, review
          schedule, review history, and plan state through Supabase.
        </p>
      </div>

      {!authConfigured ? (
        <div className="rounded-[32px] border border-[color:var(--color-warning)] bg-[rgba(179,122,42,0.1)] px-6 py-6 text-sm leading-7 text-[color:var(--color-foreground)] shadow-[0_18px_60px_rgba(16,27,54,0.08)]">
          Supabase auth is not configured in this environment yet. Set
          `NEXT_PUBLIC_SUPABASE_URL` and
          `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, then redeploy or restart local
          dev.
        </div>
      ) : null}

      {params.error ? (
        <div className="rounded-[28px] border border-[color:var(--color-danger)] bg-[rgba(187,79,59,0.08)] px-5 py-4 text-sm text-[color:var(--color-foreground)]">
          {params.error}
        </div>
      ) : null}

      {params.message ? (
        <div className="rounded-[28px] border border-[color:var(--color-accent-secondary)] bg-[rgba(47,139,115,0.08)] px-5 py-4 text-sm text-[color:var(--color-foreground)]">
          {params.message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="soft-panel rounded-[32px] px-6 py-6">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[color:var(--color-accent)]">
            Sign In
          </p>
          <form action={signInAction} className="mt-5 space-y-4">
            <fieldset disabled={!authConfigured} className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-[color:var(--color-foreground)]">
                  Email
                </span>
                <input
                  required
                  type="email"
                  name="email"
                  autoComplete="email"
                  className="mt-2 h-12 w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 text-sm text-[color:var(--color-foreground)] outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus:border-[color:var(--color-accent)]"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-[color:var(--color-foreground)]">
                  Password
                </span>
                <input
                  required
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  minLength={8}
                  className="mt-2 h-12 w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 text-sm text-[color:var(--color-foreground)] outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus:border-[color:var(--color-accent)]"
                />
              </label>
              <button
                type="submit"
                className="rounded-full bg-[color:var(--color-foreground)] px-5 py-3 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Sign in
              </button>
            </fieldset>
          </form>
        </div>

        <div className="soft-panel rounded-[32px] px-6 py-6">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[color:var(--color-accent)]">
            Create Account
          </p>
          <form action={signUpAction} className="mt-5 space-y-4">
            <fieldset disabled={!authConfigured} className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-[color:var(--color-foreground)]">
                  Email
                </span>
                <input
                  required
                  type="email"
                  name="email"
                  autoComplete="email"
                  className="mt-2 h-12 w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 text-sm text-[color:var(--color-foreground)] outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus:border-[color:var(--color-accent)]"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-[color:var(--color-foreground)]">
                  Password
                </span>
                <input
                  required
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  minLength={8}
                  className="mt-2 h-12 w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 text-sm text-[color:var(--color-foreground)] outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus:border-[color:var(--color-accent)]"
                />
              </label>
              <p className="text-sm leading-7 text-[color:var(--color-muted)]">
                This uses email/password first because it is the lowest-friction
                path to a credible staging and production setup. Social auth can
                come later without changing the data model.
              </p>
              <button
                type="submit"
                className="rounded-full border border-[color:var(--color-border)] px-5 py-3 text-sm font-medium text-[color:var(--color-foreground)] transition-colors hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Create account
              </button>
            </fieldset>
          </form>
        </div>
      </div>

      <p className="text-sm leading-7 text-[color:var(--color-muted)]">
        Need to inspect the live product loop first? Go back to{" "}
        <Link href="/" className="text-[color:var(--color-accent)] underline">
          the dashboard
        </Link>
        .
      </p>
    </section>
  );
}
