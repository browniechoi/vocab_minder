"use client";

import { SearchPanel } from "@/components/search-panel";

export default function Home() {
  return (
    <section className="space-y-8">
      <SearchPanel />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-[32px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-6 py-7 shadow-[0_18px_60px_rgba(16,27,54,0.08)] sm:px-8">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-[color:var(--color-accent)]">
            V0 Search Loop
          </p>
          <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight text-[color:var(--color-foreground)] sm:text-5xl">
            Search an English word, auto-save it, then turn it into review
            pressure.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[color:var(--color-muted)]">
            This first cut now has live auth, Supabase-backed vocab storage for
            signed-in users, and a local review cache while the review tables
            are still being wired.
          </p>
        </div>

        <div className="rounded-[32px] border border-[color:var(--color-border)] bg-[linear-gradient(180deg,rgba(227,108,63,0.12),rgba(61,141,122,0.08))] px-6 py-7 shadow-[0_18px_60px_rgba(16,27,54,0.08)]">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-[color:var(--color-accent)]">
            Product Guardrails
          </p>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-[color:var(--color-foreground)]">
            <li>Every successful search auto-adds unless the user is at plan cap.</li>
            <li>Free tier is set to 500 active vocabs in the demo state.</li>
            <li>Archive frees a slot quickly, and delete permanently removes clutter.</li>
            <li>Review scheduling uses a simplified SM-2 style loop.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
