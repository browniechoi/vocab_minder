import Link from "next/link";
import { NavLink } from "@/components/nav-link";
import { SearchShortcut } from "@/components/search-shortcut";
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
  const syncLabel = remotePersistenceEnabled
    ? "Synced"
    : authConfigured
      ? "Local"
      : "Setup needed";
  const syncClass = remotePersistenceEnabled
    ? "bg-[color:var(--color-accent-secondary)]"
    : authConfigured
      ? "bg-[color:var(--color-warning)]"
      : "bg-[color:var(--color-danger)]";

  return (
    <div className="min-h-screen">
      <SearchShortcut />
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-3 py-3 sm:px-4 lg:px-5">
        <header className="soft-panel dotted-grid rounded-[22px] px-3 py-3 sm:px-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center justify-between gap-3">
              <Link href="/" className="inline-flex items-center gap-2.5">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--color-foreground)] text-base font-semibold text-white">
                  V
                </span>
                <p className="text-base font-semibold text-[color:var(--color-foreground)]">
                  VocabMinder
                </p>
              </Link>
              <span
                title={syncLabel}
                aria-label={syncLabel}
                className={`inline-flex h-2.5 w-2.5 rounded-full ${syncClass}`}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <nav className="flex flex-wrap gap-1.5">
                <NavLink href="/">Dashboard</NavLink>
                <NavLink href="/review">Review</NavLink>
                <NavLink href="/vocab">Vocabulary</NavLink>
                <NavLink href="/settings">Settings</NavLink>
              </nav>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {authUserEmail ? (
                  <>
                    <span className="max-w-56 truncate rounded-full border border-[color:var(--color-border)] bg-white px-3 py-1.5 text-[color:var(--color-foreground)]">
                      {authUserEmail}
                    </span>
                    <form action={signOutAction}>
                      <button
                        type="submit"
                        className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface-strong)] px-3 py-1.5 font-medium text-[color:var(--color-foreground)] transition-colors hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
                      >
                        Sign out
                      </button>
                    </form>
                  </>
                ) : authConfigured ? (
                  <Link
                    href="/login"
                    className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface-strong)] px-3 py-1.5 font-medium text-[color:var(--color-foreground)] transition-colors hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
                  >
                    Sign in
                  </Link>
                ) : (
                  <span className="rounded-full border border-[color:var(--color-warning)] bg-[rgba(179,122,42,0.1)] px-3 py-1.5 text-[color:var(--color-foreground)]">
                    Supabase env missing
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 py-4">{children}</main>
      </div>
    </div>
  );
}
