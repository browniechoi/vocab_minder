"use client";

import { useState } from "react";
import { useAppState } from "@/components/app-state-provider";
import { DefinitionLabelList } from "@/components/definition-label-list";
import { PronunciationList } from "@/components/pronunciation-list";
import { buildClozeSentence } from "@/lib/cloze";
import { parseDefinitionLabelText } from "@/lib/definition-labels";
import type { ReviewRating } from "@/lib/app-types";
import {
  RATING_LABELS,
  formatDueLabel,
  formatReviewInterval,
  getReviewRetrievability,
  previewReview,
} from "@/lib/review";

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

type SessionFeedback = {
  message: string;
  tone: "error" | "success";
};

function getCardTypeLabel(cardType: string) {
  if (cardType === "production") {
    return "Reverse recall";
  }
  if (cardType === "listening") {
    return "Listening recall";
  }
  return "Recognition";
}

function getCardTypeDescription(cardType: string) {
  if (cardType === "production") {
    return "Type the word from a clue.";
  }
  if (cardType === "listening") {
    return "Hear audio, then type the word.";
  }
  return "Recall the meaning from the word.";
}

function normalizeTypedAnswer(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/:\d+$/u, "")
    .toLowerCase()
    .replace(/[^a-z0-9']+/g, " ")
    .trim();
}

function getAcceptedTypedAnswers(canonicalTerm: string, normalizedTerm: string) {
  const baseTerm = canonicalTerm.replace(/:\d+$/u, "");
  const baseNormalizedTerm = normalizedTerm.replace(/:\d+$/u, "");

  return new Set(
    [canonicalTerm, baseTerm, normalizedTerm, baseNormalizedTerm]
      .map(normalizeTypedAnswer)
      .filter(Boolean),
  );
}

function removeTypedAnswer(
  answers: Record<string, string>,
  cardId: string,
): Record<string, string> {
  const nextAnswers = { ...answers };
  delete nextAnswers[cardId];
  return nextAnswers;
}

export function ReviewStudio() {
  const { answerCard, dueItems, reviewsToday, updateVocabBack } = useAppState();
  const [deferredAgainIds, setDeferredAgainIds] = useState<string[]>([]);
  const [backEditMessage, setBackEditMessage] = useState<string | null>(null);
  const [editingBackCardId, setEditingBackCardId] = useState<string | null>(null);
  const [editClozeSentence, setEditClozeSentence] = useState("");
  const [editDefinition, setEditDefinition] = useState("");
  const [editDefinitionLabels, setEditDefinitionLabels] = useState("");
  const [editExampleSentence, setEditExampleSentence] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSavingBack, setIsSavingBack] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revealedCardId, setRevealedCardId] = useState<string | null>(null);
  const [sessionFeedback, setSessionFeedback] =
    useState<SessionFeedback | null>(null);
  const [typedAnswers, setTypedAnswers] = useState<Record<string, string>>({});

  const dueItemIds = new Set(dueItems.map((item) => item.reviewCard.id));
  const activeDeferredAgainIds = deferredAgainIds.filter((id) => dueItemIds.has(id));
  const deferredAgainIdSet = new Set(activeDeferredAgainIds);
  const deferredAgainItems = activeDeferredAgainIds.flatMap((id) => {
    const item = dueItems.find((candidate) => candidate.reviewCard.id === id);
    return item ? [item] : [];
  });
  const sessionQueue = [
    ...dueItems.filter((item) => !deferredAgainIdSet.has(item.reviewCard.id)),
    ...deferredAgainItems,
  ];

  const current = sessionQueue[0];
  const remainingReviewCount = sessionQueue.length;
  const upcomingItems = sessionQueue.slice(1);
  const upcomingReviewCount = upcomingItems.length;
  const upcomingTypeSummaries = [
    {
      cardType: "production",
      count: upcomingItems.filter(
        (item) => item.reviewCard.cardType === "production",
      ).length,
    },
    {
      cardType: "recognition",
      count: upcomingItems.filter(
        (item) => item.reviewCard.cardType === "recognition",
      ).length,
    },
    {
      cardType: "listening",
      count: upcomingItems.filter(
        (item) => item.reviewCard.cardType === "listening",
      ).length,
    },
  ].filter((summary) => summary.count > 0);
  const currentCardId = current?.reviewCard.id;
  const revealed = Boolean(currentCardId && revealedCardId === currentCardId);
  const typedAnswer = currentCardId ? typedAnswers[currentCardId] ?? "" : "";
  const ratingPreviews = current
    ? (["again", "hard", "good", "easy"] as ReviewRating[]).map((rating) => ({
        nextDueLabel: formatDueLabel(
          previewReview(current.reviewState, rating).dueAt,
        ),
        nextIntervalLabel: formatReviewInterval(
          previewReview(current.reviewState, rating).intervalDays,
        ),
        rating,
      }))
    : [];
  const isProductionCard = current?.reviewCard.cardType === "production";
  const clozeSentence = current
    ? buildClozeSentence({
        clozeSentence: current.clozeSentence,
        exampleSentence: current.exampleSentence,
        term: current.canonicalTerm,
      })
    : "";
  const retrievability = current
    ? getReviewRetrievability(current.reviewState)
    : null;

  async function checkProductionAnswer() {
    if (!current || !currentCardId || isSubmitting || isSavingBack) {
      return;
    }

    setBackEditMessage(null);
    setEditingBackCardId(null);
    setErrorMessage(null);

    const normalizedAnswer = normalizeTypedAnswer(typedAnswer);
    if (!normalizedAnswer) {
      setRevealedCardId(currentCardId);
      setSessionFeedback({
        message: "Answer shown. Self-grade this card.",
        tone: "error",
      });
      return;
    }

    const acceptedAnswers = getAcceptedTypedAnswers(
      current.canonicalTerm,
      current.normalizedTerm,
    );
    if (!acceptedAnswers.has(normalizedAnswer)) {
      setRevealedCardId(currentCardId);
      setSessionFeedback({
        message:
          "Not quite. The correct spelling is shown below; self-grade this card.",
        tone: "error",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await answerCard(currentCardId, "easy");
      if (!result.success) {
        setErrorMessage(
          result.message ??
            "Review answer failed before the session queue could advance.",
        );
        return;
      }

      setDeferredAgainIds((currentIds) =>
        currentIds.filter((id) => id !== currentCardId),
      );
      setTypedAnswers((currentAnswers) =>
        removeTypedAnswer(currentAnswers, currentCardId),
      );
      setRevealedCardId(null);
      setSessionFeedback({
        message: "Correct. Marked Easy and moved forward.",
        tone: "success",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!current) {
    return (
      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="soft-panel rounded-[24px] px-5 py-5">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[color:var(--color-accent)]">
            Queue Complete
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-[color:var(--color-foreground)]">
            Nothing is due right now.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[color:var(--color-muted)]">
            That is the right kind of empty state. Search a few more words or
            wait for cards to come due again.
          </p>
          {sessionFeedback ? (
            <p
              className={`mt-4 rounded-[18px] px-4 py-3 text-sm font-medium ${
                sessionFeedback.tone === "success"
                  ? "bg-[rgba(47,139,115,0.1)] text-[color:var(--color-accent-secondary)]"
                  : "bg-[rgba(187,79,59,0.08)] text-[color:var(--color-danger)]"
              }`}
            >
              {sessionFeedback.message}
            </p>
          ) : null}
        </div>

        <div className="soft-panel rounded-[24px] px-5 py-5">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[color:var(--color-accent)]">
            Session Stats
          </p>
          <p className="mt-2 text-3xl font-semibold">{reviewsToday}</p>
          <p className="mt-1 text-sm leading-6 text-[color:var(--color-muted)]">
            Reviews logged today for the active account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="soft-panel rounded-[24px] px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-[color:var(--color-accent)]">
              {current ? getCardTypeLabel(current.reviewCard.cardType) : "Current Card"}
            </p>
            <span className="rounded-full bg-[rgba(17,32,57,0.06)] px-2.5 py-1 text-xs font-medium text-[color:var(--color-muted)]">
              Due {formatDueLabel(current.reviewState.dueAt)}
            </span>
            <span className="rounded-full bg-[rgba(47,139,115,0.1)] px-2.5 py-1 text-xs font-medium text-[color:var(--color-accent-secondary)]">
              {remainingReviewCount} left
            </span>
          </div>
          <span className="rounded-full bg-[rgba(17,32,57,0.08)] px-2.5 py-1 text-xs font-medium text-[color:var(--color-foreground)]">
            previous interval {formatReviewInterval(current.reviewState.intervalDays)}
          </span>
        </div>

        <div className="mt-4 rounded-[20px] border border-[color:var(--color-border)] bg-white px-4 py-5 sm:px-5">
          <p className="text-[0.68rem] font-medium uppercase tracking-[0.26em] text-[color:var(--color-accent)]">
            Front
          </p>
          {isProductionCard ? (
            <div className="mt-3 space-y-3">
              <DefinitionLabelList labels={current.definitionLabels} />
              <p className="text-base leading-7 text-[color:var(--color-foreground)]">
                {current.definition}
              </p>
              <p className="rounded-[18px] bg-[rgba(47,139,115,0.08)] px-4 py-3 text-sm italic leading-6 text-[color:var(--color-foreground)]">
                &quot;{clozeSentence}&quot;
              </p>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                  Type the word
                </span>
                <input
                  value={typedAnswer}
                  onChange={(event) => {
                    const nextAnswer = event.target.value;
                    if (!currentCardId) {
                      return;
                    }
                    setSessionFeedback(null);
                    setTypedAnswers((currentAnswers) => ({
                      ...currentAnswers,
                      [currentCardId]: nextAnswer,
                    }));
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void checkProductionAnswer();
                    }
                  }}
                  disabled={revealed || isSubmitting || isSavingBack}
                  autoCapitalize="none"
                  autoComplete="off"
                  autoCorrect="off"
                  className="mt-2 h-10 w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 text-base text-[color:var(--color-foreground)] outline-none focus:border-[color:var(--color-accent)] disabled:opacity-70"
                />
              </label>
            </div>
          ) : (
            <>
              <h2 className="mt-3 text-3xl font-semibold text-[color:var(--color-foreground)]">
                {current.canonicalTerm}
              </h2>
              <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                {current.partOfSpeech}
              </p>
              <PronunciationList compact pronunciations={current.pronunciations} />
            </>
          )}

          {revealed ? (
            <div className="mt-5 space-y-3 border-t border-[color:var(--color-border)] pt-4">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[0.68rem] font-medium uppercase tracking-[0.26em] text-[color:var(--color-accent)]">
                    Back
                  </p>
                  {editingBackCardId !== current.id ? (
                    <button
                      type="button"
                      onClick={() => {
                        setBackEditMessage(null);
                        setEditingBackCardId(current.id);
                        setEditClozeSentence(current.clozeSentence ?? "");
                        setEditDefinition(current.definition);
                        setEditDefinitionLabels(
                          current.definitionLabels?.join(", ") ?? "",
                        );
                        setEditExampleSentence(current.exampleSentence);
                      }}
                      className="rounded-full border border-[color:var(--color-border)] px-2.5 py-1 text-xs font-medium text-[color:var(--color-foreground)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
                    >
                      Edit
                    </button>
                  ) : null}
                </div>

                {editingBackCardId === current.id ? (
                  <form
                    className="mt-3 space-y-3"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      setBackEditMessage(null);
                      setIsSavingBack(true);
                      try {
                        const result = await updateVocabBack(current.id, {
                          clozeSentence: editClozeSentence,
                          definition: editDefinition,
                          definitionLabels:
                            parseDefinitionLabelText(editDefinitionLabels),
                          exampleSentence: editExampleSentence,
                        });

                        if (!result.success) {
                          setBackEditMessage(
                            result.message ?? "Back update failed.",
                          );
                          return;
                        }

                        setEditingBackCardId(null);
                      } finally {
                        setIsSavingBack(false);
                      }
                    }}
                  >
                    <label className="block">
                      <span className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                        Labels
                      </span>
                      <input
                        value={editDefinitionLabels}
                        onChange={(event) =>
                          setEditDefinitionLabels(event.target.value)
                        }
                        placeholder="formal, literary"
                        className="mt-1.5 h-10 w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 text-sm text-[color:var(--color-foreground)] outline-none focus:border-[color:var(--color-accent)]"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                        Definition
                      </span>
                      <textarea
                        required
                        value={editDefinition}
                        onChange={(event) => setEditDefinition(event.target.value)}
                        className="mt-1.5 min-h-20 w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2 text-sm leading-6 text-[color:var(--color-foreground)] outline-none focus:border-[color:var(--color-accent)]"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                        Example
                      </span>
                      <textarea
                        value={editExampleSentence}
                        onChange={(event) =>
                          setEditExampleSentence(event.target.value)
                        }
                        className="mt-1.5 min-h-20 w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2 text-sm italic leading-6 text-[color:var(--color-foreground)] outline-none focus:border-[color:var(--color-accent)]"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                        Cloze
                      </span>
                      <textarea
                        value={editClozeSentence}
                        onChange={(event) =>
                          setEditClozeSentence(event.target.value)
                        }
                        placeholder="Use _____ for the hidden word."
                        className="mt-1.5 min-h-20 w-full rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2 text-sm italic leading-6 text-[color:var(--color-foreground)] outline-none focus:border-[color:var(--color-accent)]"
                      />
                    </label>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="submit"
                        disabled={isSavingBack}
                        className="rounded-full bg-[color:var(--color-foreground)] px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isSavingBack ? "Saving..." : "Save"}
                      </button>
                      <button
                        type="button"
                        disabled={isSavingBack}
                        onClick={() => {
                          setBackEditMessage(null);
                          setEditingBackCardId(null);
                        }}
                        className="rounded-full border border-[color:var(--color-border)] px-3 py-1.5 text-sm font-medium text-[color:var(--color-foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  isProductionCard ? (
                    <div className="space-y-3">
                      {typedAnswer.trim() ? (
                        <p className="rounded-[16px] bg-[rgba(17,32,57,0.06)] px-3 py-2 text-sm text-[color:var(--color-muted)]">
                          Your answer:{" "}
                          <span className="font-medium text-[color:var(--color-foreground)]">
                            {typedAnswer}
                          </span>
                        </p>
                      ) : null}
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                        Correct spelling
                      </p>
                      <h2 className="text-3xl font-semibold text-[color:var(--color-foreground)]">
                        {current.canonicalTerm}
                      </h2>
                      <p className="text-sm text-[color:var(--color-muted)]">
                        {current.partOfSpeech}
                      </p>
                      <PronunciationList compact pronunciations={current.pronunciations} />
                    </div>
                  ) : (
                    <>
                      <DefinitionLabelList labels={current.definitionLabels} />
                      <p className="mt-2 text-base leading-6 text-[color:var(--color-foreground)]">
                        {current.definition}
                      </p>
                    </>
                  )
                )}
                {backEditMessage ? (
                  <p className="mt-3 rounded-[16px] border border-[color:var(--color-danger)] bg-[rgba(187,79,59,0.08)] px-3 py-2 text-sm text-[color:var(--color-foreground)]">
                    {backEditMessage}
                  </p>
                ) : null}
              </div>
              {editingBackCardId !== current.id && !isProductionCard ? (
                <p className="rounded-[18px] bg-[rgba(47,139,115,0.08)] px-4 py-3 text-sm italic leading-6 text-[color:var(--color-foreground)]">
                  “{current.exampleSentence}”
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {sessionFeedback ? (
          <div
            className={`mt-3 rounded-[18px] border px-3 py-2 text-sm font-medium leading-6 ${
              sessionFeedback.tone === "success"
                ? "border-[color:var(--color-accent-secondary)] bg-[rgba(47,139,115,0.08)] text-[color:var(--color-accent-secondary)]"
                : "border-[color:var(--color-danger)] bg-[rgba(187,79,59,0.08)] text-[color:var(--color-danger)]"
            }`}
          >
            {sessionFeedback.message}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={revealed}
            onClick={async () => {
              setErrorMessage(null);
              if (isProductionCard && !revealed) {
                await checkProductionAnswer();
                return;
              }
              setSessionFeedback(null);
              if (revealed) {
                setBackEditMessage(null);
                setEditingBackCardId(null);
              }
              setRevealedCardId((currentRevealedCardId) =>
                currentRevealedCardId === currentCardId
                  ? null
                  : currentCardId ?? null,
              );
            }}
            disabled={isSubmitting || isSavingBack}
            className="rounded-full bg-[color:var(--color-foreground)] px-4 py-2 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
          >
            {isSubmitting
              ? "Saving..."
              : revealed
                ? "Unreveal answer"
                : isProductionCard
                  ? "Check spelling"
                  : "Reveal answer"}
          </button>
          {ratingPreviews.map(({ nextDueLabel, nextIntervalLabel, rating }) => (
            <button
              key={rating}
              type="button"
              disabled={
                !revealed ||
                isSubmitting ||
                isSavingBack ||
                editingBackCardId === current.id
              }
              onClick={async () => {
                const currentId = current.reviewCard.id;
                setErrorMessage(null);
                setSessionFeedback(null);
                setIsSubmitting(true);
                try {
                  const result = await answerCard(currentId, rating);
                  if (!result.success) {
                    setErrorMessage(
                      result.message ??
                        "Review answer failed before the session queue could advance.",
                    );
                    return;
                  }
                  setDeferredAgainIds((currentIds) => {
                    const remainingIds = currentIds.filter((id) => id !== currentId);
                    if (rating === "again") {
                      remainingIds.push(currentId);
                    }
                    return remainingIds;
                  });
                  setBackEditMessage(null);
                  setEditingBackCardId(null);
                  setRevealedCardId(null);
                  setTypedAnswers((currentAnswers) =>
                    removeTypedAnswer(currentAnswers, currentId),
                  );
                } finally {
                  setIsSubmitting(false);
                }
              }}
              className={`flex min-w-20 flex-col items-center rounded-full border px-4 py-2 text-sm font-medium leading-tight transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${ratingTone[rating]}`}
            >
              <span>{RATING_LABELS[rating]}</span>
              <span className="mt-1 text-xs opacity-75">{nextDueLabel}</span>
              {nextDueLabel.replace(/^in /, "") !== nextIntervalLabel ? (
                <span className="sr-only">interval {nextIntervalLabel}</span>
              ) : null}
            </button>
          ))}
        </div>
        {errorMessage ? (
          <div className="mt-3 rounded-[18px] border border-[color:var(--color-danger)] bg-[rgba(187,79,59,0.08)] px-3 py-2 text-sm leading-6 text-[color:var(--color-foreground)]">
            {errorMessage}
          </div>
        ) : null}
      </div>

      <div className="grid content-start gap-4">
        <div className="soft-panel rounded-[24px] px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-[color:var(--color-accent)]">
              Queue
            </p>
            <span className="rounded-full bg-[rgba(17,32,57,0.08)] px-3 py-1 text-xs font-medium text-[color:var(--color-foreground)]">
              {upcomingReviewCount} next
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {upcomingTypeSummaries.length > 0 ? (
              upcomingTypeSummaries.map(({ cardType, count }) => (
                <span
                  key={cardType}
                  title={getCardTypeDescription(cardType)}
                  className="rounded-full border border-[color:var(--color-border)] bg-white px-3 py-1.5 text-xs font-medium text-[color:var(--color-foreground)]"
                >
                  {count} {getCardTypeLabel(cardType)}
                </span>
              ))
            ) : (
              <p className="rounded-[18px] border border-dashed border-[color:var(--color-border)] px-3 py-3 text-sm text-[color:var(--color-muted)]">
                Last due card.
              </p>
            )}
          </div>
        </div>

        <details className="soft-panel rounded-[24px] px-4 py-4">
          <summary className="cursor-pointer text-xs font-medium uppercase tracking-[0.28em] text-[color:var(--color-accent)]">
            Scheduler
          </summary>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-[16px] border border-[color:var(--color-border)] bg-white px-3 py-3">
              <dt className="text-[color:var(--color-muted)]">Repetitions</dt>
              <dd className="mt-1 text-lg font-semibold text-[color:var(--color-foreground)]">
                {current.reviewState.repetitionCount}
              </dd>
            </div>
            <div className="rounded-[16px] border border-[color:var(--color-border)] bg-white px-3 py-3">
              <dt className="text-[color:var(--color-muted)]">Difficulty</dt>
              <dd className="mt-1 text-lg font-semibold text-[color:var(--color-foreground)]">
                {current.reviewState.difficulty.toFixed(2)}
              </dd>
            </div>
            <div className="rounded-[16px] border border-[color:var(--color-border)] bg-white px-3 py-3">
              <dt className="text-[color:var(--color-muted)]">Retrievability</dt>
              <dd className="mt-1 text-lg font-semibold text-[color:var(--color-foreground)]">
                {retrievability === null
                  ? "new"
                  : `${Math.round(retrievability * 100)}%`}
              </dd>
            </div>
            <div className="rounded-[16px] border border-[color:var(--color-border)] bg-white px-3 py-3">
              <dt className="text-[color:var(--color-muted)]">Lapses</dt>
              <dd className="mt-1 text-lg font-semibold text-[color:var(--color-foreground)]">
                {current.reviewState.lapseCount}
              </dd>
            </div>
          </dl>
        </details>
      </div>
    </div>
  );
}
