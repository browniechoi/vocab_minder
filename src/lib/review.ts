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

export function isDue(reviewState: ReviewState, now = new Date()) {
  return new Date(reviewState.dueAt).getTime() <= now.getTime();
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
  const emptyCard = createEmptyCard(new Date(reviewState.dueAt));
  const intervalDays = Number.isFinite(reviewState.intervalDays)
    ? reviewState.intervalDays
    : 0;
  const stabilityDays = Number.isFinite(reviewState.stabilityDays)
    ? reviewState.stabilityDays
    : Math.max(intervalDays, 0);
  const difficulty = Number.isFinite(reviewState.difficulty)
    ? reviewState.difficulty
    : Number.isFinite(reviewState.easeFactor)
      ? reviewState.easeFactor
      : 0;

  return {
    ...emptyCard,
    due: new Date(reviewState.dueAt),
    stability: stabilityDays,
    difficulty,
    elapsed_days: Math.max(0, Math.round(intervalDays)),
    scheduled_days: Math.max(0, Math.round(intervalDays)),
    learning_steps: reviewState.learningSteps ?? 0,
    reps: reviewState.repetitionCount ?? 0,
    lapses: reviewState.lapseCount ?? 0,
    state: memoryStateToFsrs[getMemoryState(reviewState)],
    last_review: reviewState.lastReviewedAt
      ? new Date(reviewState.lastReviewedAt)
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
