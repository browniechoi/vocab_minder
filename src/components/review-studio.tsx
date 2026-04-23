"use client";

import { useState } from "react";
import { useAppState } from "@/components/app-state-provider";
import { PronunciationList } from "@/components/pronunciation-list";
import type { ReviewRating } from "@/lib/app-types";
import { RATING_LABELS, formatDueLabel, formatReviewInterval } from "@/lib/review";

const ratingTone: Record<ReviewRating, string> = {
  again:
    "border-[color:var(--color-danger)] text-[color:var(--color-danger)] hover:bg-[rgba(187,79,59,0.08)]",
  hard:
    "border-[color:var(--color-warning)] text-[color:var(--color-warning)] hover:bg-[rgba(179,122,42,0.08)]",
  good:
    "border-[color:var(--color-accent-secondary)] text-[color:var(--color-accent-secondary)] hover:bg-[rgba(47,139,115,0.08)]",
  easy:
    "border-[color:var(--color-foreground)] text-[color:var(--color-foreground)] hover:bg-[rgba(17,32,57,0.08)]",
};

export function ReviewStudio() {
  const { answerCard, dueItems, reviewsToday } = useAppState();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const current = dueItems[0];
  const nextUp = dueItems.slice(1, 4);

  if (!current) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_0.7fr]">
        <div className="soft-panel rounded-[32px] px-6 py-6">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[color:var(--color-accent)]">
            Queue Complete
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-[color:var(--color-foreground)]">
            Nothing is due right now.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[color:var(--color-muted)]">
            That is the right kind of empty state. Search a few more words or
            wait for cards to come due again.
          </p>
        </div>

        <div className="soft-panel rounded-[32px] px-6 py-6">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[color:var(--color-accent)]">
            Session Stats
          </p>
          <p className="mt-3 text-4xl font-semibold">{reviewsToday}</p>
          <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
            Reviews logged today for the active account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="soft-panel rounded-[32px] px-6 py-6 sm:px-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-[color:var(--color-accent)]">
              Current Card
            </p>
            <p className="mt-2 text-sm text-[color:var(--color-muted)]">
              Due {formatDueLabel(current.reviewState.dueAt)}
            </p>
          </div>
          <span className="rounded-full bg-[rgba(17,32,57,0.08)] px-3 py-1 text-xs font-medium text-[color:var(--color-foreground)]">
            interval {formatReviewInterval(current.reviewState.intervalDays)}
          </span>
        </div>

        <div className="mt-8 rounded-[28px] border border-[color:var(--color-border)] bg-white px-6 py-8">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-[color:var(--color-accent)]">
            Front
          </p>
          <h2 className="mt-4 text-4xl font-semibold text-[color:var(--color-foreground)]">
            {current.canonicalTerm}
          </h2>
          <p className="mt-2 text-sm text-[color:var(--color-muted)]">
            {current.partOfSpeech}
          </p>
          <PronunciationList pronunciations={current.pronunciations} />

          {revealed ? (
            <div className="mt-8 space-y-4 border-t border-[color:var(--color-border)] pt-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.28em] text-[color:var(--color-accent)]">
                  Back
                </p>
                <p className="mt-3 text-base leading-7 text-[color:var(--color-foreground)]">
                  {current.definition}
                </p>
              </div>
              <p className="rounded-[22px] bg-[rgba(47,139,115,0.08)] px-4 py-4 text-sm italic leading-7 text-[color:var(--color-foreground)]">
                “{current.exampleSentence}”
              </p>
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setRevealed(true)}
            disabled={isSubmitting}
            className="rounded-full bg-[color:var(--color-foreground)] px-5 py-3 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
          >
            {isSubmitting ? "Saving..." : "Reveal answer"}
          </button>
          {(["again", "hard", "good", "easy"] as ReviewRating[]).map((rating) => (
            <button
              key={rating}
              type="button"
              disabled={!revealed || isSubmitting}
              onClick={async () => {
                setIsSubmitting(true);
                try {
                  await answerCard(current.id, rating);
                  setRevealed(false);
                } finally {
                  setIsSubmitting(false);
                }
              }}
              className={`rounded-full border px-5 py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${ratingTone[rating]}`}
            >
              {RATING_LABELS[rating]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6">
        <div className="soft-panel rounded-[32px] px-6 py-6">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[color:var(--color-accent)]">
            Next Up
          </p>
          <div className="mt-5 space-y-3">
            {nextUp.length > 0 ? (
              nextUp.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[20px] border border-[color:var(--color-border)] bg-white px-4 py-4"
                >
                  <p className="font-semibold text-[color:var(--color-foreground)]">
                    {item.canonicalTerm}
                  </p>
                  <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                    {item.partOfSpeech}
                  </p>
                  <PronunciationList pronunciations={item.pronunciations} compact />
                </div>
              ))
            ) : (
              <p className="rounded-[20px] border border-dashed border-[color:var(--color-border)] px-4 py-5 text-sm text-[color:var(--color-muted)]">
                This is the last due card in the queue.
              </p>
            )}
          </div>
        </div>

        <div className="soft-panel rounded-[32px] px-6 py-6">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[color:var(--color-accent)]">
            Scheduler State
          </p>
          <dl className="mt-5 grid gap-4 text-sm">
            <div className="rounded-[20px] border border-[color:var(--color-border)] bg-white px-4 py-4">
              <dt className="text-[color:var(--color-muted)]">Repetitions</dt>
              <dd className="mt-1 text-xl font-semibold text-[color:var(--color-foreground)]">
                {current.reviewState.repetitionCount}
              </dd>
            </div>
            <div className="rounded-[20px] border border-[color:var(--color-border)] bg-white px-4 py-4">
              <dt className="text-[color:var(--color-muted)]">Ease factor</dt>
              <dd className="mt-1 text-xl font-semibold text-[color:var(--color-foreground)]">
                {current.reviewState.easeFactor.toFixed(2)}
              </dd>
            </div>
            <div className="rounded-[20px] border border-[color:var(--color-border)] bg-white px-4 py-4">
              <dt className="text-[color:var(--color-muted)]">Lapses</dt>
              <dd className="mt-1 text-xl font-semibold text-[color:var(--color-foreground)]">
                {current.reviewState.lapseCount}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
