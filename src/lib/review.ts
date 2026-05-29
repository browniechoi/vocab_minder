import {
  createEmptyCard,
  fsrs,
  Rating as FsrsRating,
  State as FsrsState,
  type Card as FsrsCard,
  type Grade,
} from "ts-fsrs";
import type {
  ReviewMemoryState,
  ReviewRating,
  ReviewState,
} from "@/lib/app-types";

const DAY_MS = 24 * 60 * 60 * 1000;
export const DESIRED_RETENTION = 0.92;
export const NEW_WORD_DUE_CARD_LIMIT = 40;

const scheduler = fsrs({
  request_retention: DESIRED_RETENTION,
  maximum_interval: 36500,
  enable_fuzz: false,
  enable_short_term: true,
  learning_steps: ["10m"],
  relearning_steps: ["10m"],
});

const ratingToFsrs: Record<ReviewRating, Grade> = {
  again: FsrsRating.Again,
  hard: FsrsRating.Hard,
  good: FsrsRating.Good,
  easy: FsrsRating.Easy,
};

const memoryStateToFsrs: Record<ReviewMemoryState, FsrsState> = {
  New: FsrsState.New,
  Learning: FsrsState.Learning,
  Review: FsrsState.Review,
  Relearning: FsrsState.Relearning,
};

const fsrsStateToMemory: Record<FsrsState, ReviewMemoryState> = {
  [FsrsState.New]: "New",
  [FsrsState.Learning]: "Learning",
  [FsrsState.Review]: "Review",
  [FsrsState.Relearning]: "Relearning",
};

export const RATING_LABELS: Record<ReviewRating, string> = {
  again: "Again",
  hard: "Hard",
  good: "Good",
  easy: "Easy",
};

export function createInitialReviewState(now = new Date()): ReviewState {
  return {
    dueAt: now.toISOString(),
    intervalDays: 0,
    easeFactor: 2.5,
    repetitionCount: 0,
    lapseCount: 0,
    lastReviewedAt: null,
    stabilityDays: 0,
    difficulty: 0,
    fsrsState: "New",
    learningSteps: 0,
    desiredRetention: DESIRED_RETENTION,
  };
}

function coerceFiniteNumber(value: unknown, fallback: number) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function coerceIsoDate(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  return Number.isNaN(new Date(value).getTime()) ? fallback : value;
}

function coerceIsoDateOrNull(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  return Number.isNaN(new Date(value).getTime()) ? null : value;
}

function coerceMemoryState(value: unknown, fallback: ReviewMemoryState) {
  return value === "New" ||
    value === "Learning" ||
    value === "Review" ||
    value === "Relearning"
    ? value
    : fallback;
}

export function normalizeReviewState(
  reviewState?: Partial<ReviewState> | null,
  fallbackDate = new Date(),
): ReviewState {
  const fallback = createInitialReviewState(fallbackDate);
  if (!reviewState) {
    return fallback;
  }

  const intervalDays = coerceFiniteNumber(
    reviewState.intervalDays,
    fallback.intervalDays,
  );
  const easeFactor = coerceFiniteNumber(
    reviewState.easeFactor,
    fallback.easeFactor,
  );
  const repetitionCount = Math.max(
    0,
    Math.round(
      coerceFiniteNumber(reviewState.repetitionCount, fallback.repetitionCount),
    ),
  );

  return {
    dueAt: coerceIsoDate(reviewState.dueAt, fallback.dueAt),
    intervalDays,
    easeFactor,
    repetitionCount,
    lapseCount: Math.max(
      0,
      Math.round(coerceFiniteNumber(reviewState.lapseCount, fallback.lapseCount)),
    ),
    lastReviewedAt: coerceIsoDateOrNull(reviewState.lastReviewedAt),
    stabilityDays: coerceFiniteNumber(
      reviewState.stabilityDays,
      Math.max(intervalDays, fallback.stabilityDays),
    ),
    difficulty: coerceFiniteNumber(
      reviewState.difficulty,
      coerceFiniteNumber(reviewState.easeFactor, fallback.difficulty),
    ),
    fsrsState: coerceMemoryState(
      reviewState.fsrsState,
      repetitionCount > 0 ? "Review" : fallback.fsrsState,
    ),
    learningSteps: Math.max(
      0,
      Math.round(
        coerceFiniteNumber(reviewState.learningSteps, fallback.learningSteps),
      ),
    ),
    desiredRetention: coerceFiniteNumber(
      reviewState.desiredRetention,
      fallback.desiredRetention,
    ),
  };
}

export function isDue(reviewState: ReviewState, now = new Date()) {
  return (
    new Date(normalizeReviewState(reviewState).dueAt).getTime() <= now.getTime()
  );
}

export function applyReview(
  reviewState: ReviewState,
  rating: ReviewRating,
  now = new Date(),
): ReviewState {
  return fromFsrsCard(scheduler.next(toFsrsCard(reviewState), now, ratingToFsrs[rating]).card, now);
}

export function previewReview(
  reviewState: ReviewState,
  rating: ReviewRating,
  now = new Date(),
) {
  return fromFsrsCard(
    scheduler.repeat(toFsrsCard(reviewState), now)[ratingToFsrs[rating]].card,
    now,
  );
}

export function getReviewRetrievability(
  reviewState: ReviewState,
  now = new Date(),
) {
  if (getMemoryState(reviewState) === "New") {
    return null;
  }

  return scheduler.get_retrievability(toFsrsCard(reviewState), now, false);
}

export function shouldUnlockProduction(reviewState: ReviewState) {
  return reviewState.repetitionCount >= 2 || reviewState.intervalDays >= 1;
}

function toFsrsCard(reviewState: ReviewState): FsrsCard {
  const normalizedState = normalizeReviewState(reviewState);
  const emptyCard = createEmptyCard(new Date(normalizedState.dueAt));
  const intervalDays = normalizedState.intervalDays;
  const stabilityDays = normalizedState.stabilityDays;
  const difficulty = normalizedState.difficulty;

  return {
    ...emptyCard,
    due: new Date(normalizedState.dueAt),
    stability: stabilityDays,
    difficulty,
    elapsed_days: Math.max(0, Math.round(intervalDays)),
    scheduled_days: Math.max(0, Math.round(intervalDays)),
    learning_steps: normalizedState.learningSteps,
    reps: normalizedState.repetitionCount,
    lapses: normalizedState.lapseCount,
    state: memoryStateToFsrs[getMemoryState(normalizedState)],
    last_review: normalizedState.lastReviewedAt
      ? new Date(normalizedState.lastReviewedAt)
      : undefined,
  };
}

function getMemoryState(reviewState: ReviewState): ReviewMemoryState {
  if (
    reviewState.fsrsState === "New" ||
    reviewState.fsrsState === "Learning" ||
    reviewState.fsrsState === "Review" ||
    reviewState.fsrsState === "Relearning"
  ) {
    return reviewState.fsrsState;
  }

  return reviewState.repetitionCount > 0 ? "Review" : "New";
}

function fromFsrsCard(card: FsrsCard, now = new Date()): ReviewState {
  const intervalFromDue = Math.max(0, (card.due.getTime() - now.getTime()) / DAY_MS);
  const intervalDays =
    card.scheduled_days > 0 ? card.scheduled_days : Number(intervalFromDue.toFixed(4));

  return {
    dueAt: card.due.toISOString(),
    intervalDays,
    easeFactor: card.difficulty,
    repetitionCount: card.reps,
    lapseCount: card.lapses,
    lastReviewedAt: card.last_review?.toISOString() ?? null,
    stabilityDays: card.stability,
    difficulty: card.difficulty,
    fsrsState: fsrsStateToMemory[card.state],
    learningSteps: card.learning_steps,
    desiredRetention: DESIRED_RETENTION,
  };
}

export function formatDueLabel(dueAt: string, now = new Date()) {
  const deltaMs = new Date(dueAt).getTime() - now.getTime();

  if (deltaMs <= 0) {
    return "due now";
  }

  const minutes = Math.round(deltaMs / (60 * 1000));
  if (minutes < 60) {
    return `in ${minutes}m`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 36) {
    return `in ${hours}h`;
  }

  const days = Math.round(hours / 24);
  return `in ${days}d`;
}

export function formatReviewInterval(intervalDays: number) {
  if (intervalDays <= 0) {
    return "new";
  }

  const minutes = Math.round(intervalDays * 24 * 60);
  if (minutes < 60) {
    return `${Math.max(1, minutes)}m`;
  }

  if (intervalDays < 1) {
    return `${Math.round(intervalDays * 24)}h`;
  }

  if (intervalDays < 14) {
    return `${Math.round(intervalDays)}d`;
  }

  const weeks = intervalDays / 7;
  if (weeks < 8) {
    return `${weeks.toFixed(1)}w`;
  }

  const months = intervalDays / 30;
  return `${months.toFixed(1)}mo`;
}
