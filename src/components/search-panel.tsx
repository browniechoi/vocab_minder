"use client";

import { useState } from "react";
import { useAppState } from "@/components/app-state-provider";
import { PronunciationList } from "@/components/pronunciation-list";
import type { SearchOutcome } from "@/lib/app-types";
import { formatDueLabel, formatReviewInterval } from "@/lib/review";

const outcomeStyles: Record<SearchOutcome, string> = {
  saved:
    "border-[color:var(--color-accent-secondary)] bg-[rgba(47,139,115,0.08)] text-[color:var(--color-foreground)]",
  existing_active:
    "border-[color:var(--color-accent-secondary)] bg-[rgba(47,139,115,0.08)] text-[color:var(--color-foreground)]",
  existing_archived:
    "border-[color:var(--color-warning)] bg-[rgba(179,122,42,0.1)] text-[color:var(--color-foreground)]",
  limit_reached:
    "border-[color:var(--color-warning)] bg-[rgba(179,122,42,0.1)] text-[color:var(--color-foreground)]",
  not_found:
    "border-[color:var(--color-danger)] bg-[rgba(187,79,59,0.08)] text-[color:var(--color-foreground)]",
  empty_query:
    "border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-muted)]",
};

export function SearchPanel() {
  const {
    activeCount,
    activeItems,
    archivedItems,
    dueItems,
    remotePersistenceEnabled,
    reviewsToday,
    search,
    state,
  } = useAppState();
  const [query, setQuery] = useState("");
  const [lastResult, setLastResult] = useState<
    Awaited<ReturnType<typeof search>> | null
  >(null);
  const [isSearching, setIsSearching] = useState(false);

  const usagePercent = Math.min(
    100,
    Math.round((activeCount / state.activeLimit) * 100),
  );

  return (
    <div className="space-y-6">
      <div className="soft-panel rounded-[32px] px-6 py-6 sm:px-7">
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-[color:var(--color-accent)]">
              Search and Auto-Save
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-[color:var(--color-foreground)]">
              One search box. No separate save step.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[color:var(--color-muted)]">
              {remotePersistenceEnabled
                ? "Every successful search is saved automatically, de-duped, and synced to Supabase."
                : "Every successful search is saved automatically. Sign in when you want the library and review history to sync across devices."}
            </p>
          </div>

          <form
            className="grid gap-3 sm:grid-cols-[1fr_auto]"
            onSubmit={async (event) => {
              event.preventDefault();
              setIsSearching(true);
              try {
                setLastResult(await search(query));
              } finally {
                setIsSearching(false);
              }
            }}
          >
            <label className="sr-only" htmlFor="search">
              Search word
            </label>
            <input
              id="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try meticulous, reconcile, infer, vibrant, or squander"
              className="h-14 rounded-2xl border border-[color:var(--color-border)] bg-white px-4 text-base text-[color:var(--color-foreground)] outline-none transition-colors placeholder:text-[color:var(--color-muted)] focus:border-[color:var(--color-accent)]"
            />
            <button
              type="submit"
              disabled={isSearching}
              className="h-14 rounded-2xl bg-[color:var(--color-foreground)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
            >
              {isSearching ? "Searching..." : "Search and auto-add"}
            </button>
          </form>

          <div>
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.24em] text-[color:var(--color-muted)]">
              <span>Free tier usage</span>
              <span>{usagePercent}% full</span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-[rgba(17,32,57,0.1)]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-accent),var(--color-accent-secondary))]"
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          </div>

          {lastResult ? (
            <div
              className={`rounded-[24px] border px-5 py-5 ${outcomeStyles[lastResult.outcome]}`}
            >
              <p className="text-xs font-medium uppercase tracking-[0.28em]">
                {lastResult.outcome.replaceAll("_", " ")}
              </p>
              <p className="mt-3 text-sm leading-7">{lastResult.message}</p>
              {lastResult.entry ? (
                <div className="mt-4 rounded-[20px] border border-black/5 bg-white/70 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {lastResult.entry.canonicalTerm}
                      </h3>
                      <p className="text-sm text-[color:var(--color-muted)]">
                        {lastResult.entry.partOfSpeech}
                      </p>
                      <PronunciationList
                        pronunciations={lastResult.entry.pronunciations}
                        compact
                      />
                    </div>
                    {lastResult.vocab ? (
                      <span className="rounded-full bg-[color:var(--color-foreground)] px-3 py-1 text-xs font-medium text-white">
                        {lastResult.vocab.status}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm leading-7">
                    {lastResult.entry.definition}
                  </p>
                  <p className="mt-3 text-sm italic text-[color:var(--color-muted)]">
                    “{lastResult.entry.exampleSentence}”
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-[color:var(--color-border)] px-5 py-5 text-sm leading-7 text-[color:var(--color-muted)]">
              {remotePersistenceEnabled
                ? "Search now calls Merriam-Webster through the app server and writes successful hits into your Supabase-backed vocab library."
                : "Search now calls Merriam-Webster through the app server. Sign in when you want the vocab library to sync to Supabase instead of staying local."}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active Vocabs"
          value={`${activeCount}/${state.activeLimit}`}
          detail="Words still counting against the plan cap."
        />
        <MetricCard
          label="Due Now"
          value={`${dueItems.length}`}
          detail="Cards ready to review immediately."
        />
        <MetricCard
          label="Archived"
          value={`${archivedItems.length}`}
          detail="Removed from the active cap, but restorable."
        />
        <MetricCard
          label="Reviews Today"
          value={`${reviewsToday}`}
          detail={
            remotePersistenceEnabled
              ? "Logged answers synced to your account."
              : "Logged answers in this local preview session."
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="soft-panel rounded-[32px] px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-[color:var(--color-accent)]">
                Review Pressure
              </p>
              <h2 className="mt-3 text-xl font-semibold">Due cards</h2>
            </div>
            <span className="rounded-full bg-[rgba(17,32,57,0.08)] px-3 py-1 text-xs font-medium text-[color:var(--color-foreground)]">
              {dueItems.length} open
            </span>
          </div>
          <div className="mt-5 space-y-3">
            {dueItems.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="rounded-[20px] border border-[color:var(--color-border)] bg-white px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[color:var(--color-foreground)]">
                      {item.canonicalTerm}
                    </p>
                    <p className="text-sm text-[color:var(--color-muted)]">
                      {item.definition}
                    </p>
                  </div>
                  <span className="rounded-full bg-[rgba(221,107,63,0.12)] px-3 py-1 text-xs font-medium text-[color:var(--color-accent)]">
                    {formatDueLabel(item.reviewState.dueAt)}
                  </span>
                </div>
              </div>
            ))}
            {dueItems.length === 0 ? (
              <p className="rounded-[20px] border border-dashed border-[color:var(--color-border)] px-4 py-5 text-sm text-[color:var(--color-muted)]">
                Nothing is due right now.
              </p>
            ) : null}
          </div>
        </div>

        <div className="soft-panel rounded-[32px] px-6 py-6">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[color:var(--color-accent)]">
            Recent Vocabulary
          </p>
          <div className="mt-5 space-y-3">
            {activeItems.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="rounded-[20px] border border-[color:var(--color-border)] bg-white px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[color:var(--color-foreground)]">
                      {item.canonicalTerm}
                    </p>
                    <p className="text-sm text-[color:var(--color-muted)]">
                      {item.partOfSpeech} · {item.searchCount} searches
                    </p>
                  </div>
                  <span className="rounded-full bg-[rgba(17,32,57,0.08)] px-3 py-1 text-xs font-medium text-[color:var(--color-foreground)]">
                    {formatReviewInterval(item.reviewState.intervalDays)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="soft-panel rounded-[28px] px-5 py-5">
      <p className="text-xs font-medium uppercase tracking-[0.24em] text-[color:var(--color-muted)]">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold text-[color:var(--color-foreground)]">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-[color:var(--color-muted)]">
        {detail}
      </p>
    </div>
  );
}
