import Link from "next/link";
import { NavLink } from "@/components/nav-link";
import { signOutAction } from "@/lib/auth/actions";

export function AppShell({
  authConfigured,
  authUserEmail,
  remotePersistenceEnabled,
  children,
}: {
  authConfigured: boolean;
  authUserEmail: string | null;
  remotePersistenceEnabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="soft-panel dotted-grid rounded-[32px] px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <Link href="/" className="inline-flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--color-foreground)] text-lg font-semibold text-white">
                  V
                </span>
                <div>
                  <p className="text-lg font-semibold text-[color:var(--color-foreground)]">
                    VocabMinder
                  </p>
                  <p className="text-sm text-[color:var(--color-muted)]">
                    Look up. Keep. Review.
                  </p>
                </div>
              </Link>
              <p className="max-w-2xl text-sm leading-6 text-[color:var(--color-muted)]">
                Built as a low-maintenance English-learning tool: opinionated
                capture flow, clean plan limits, and a direct path to Supabase.
              </p>
            </div>

            <div className="flex flex-col items-start gap-3 lg:items-end">
              <nav className="flex flex-wrap gap-2">
                <NavLink href="/">Dashboard</NavLink>
                <NavLink href="/review">Review</NavLink>
                <NavLink href="/vocab">Vocabulary</NavLink>
                <NavLink href="/settings">Settings</NavLink>
              </nav>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {authUserEmail ? (
                  <>
                    <span className="rounded-full border border-[color:var(--color-border)] bg-white px-4 py-2 text-[color:var(--color-foreground)]">
                      {authUserEmail}
                    </span>
                    <form action={signOutAction}>
                      <button
                        type="submit"
                        className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface-strong)] px-4 py-2 font-medium text-[color:var(--color-foreground)] transition-colors hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
                      >
                        Sign out
                      </button>
                    </form>
                  </>
                ) : authConfigured ? (
                  <Link
                    href="/login"
                    className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface-strong)] px-4 py-2 font-medium text-[color:var(--color-foreground)] transition-colors hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
                  >
                    Sign in
                  </Link>
                ) : (
                  <span className="rounded-full border border-[color:var(--color-warning)] bg-[rgba(179,122,42,0.1)] px-4 py-2 text-[color:var(--color-foreground)]">
                    Supabase env missing
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 py-8">{children}</main>

        <footer className="mt-4 border-t border-[color:var(--color-border)] px-1 pt-4 text-sm text-[color:var(--color-muted)]">
          {remotePersistenceEnabled
            ? "Signed-in mode syncs vocabulary, review state, and review history through Supabase."
            : authConfigured
              ? "Guest mode still runs locally. Sign in to sync vocabulary and review progress through Supabase."
              : "Supabase env is still missing, so the app stays in local preview mode until the hosted project variables are configured."}
        </footer>
      </div>
    </div>
  );
}
