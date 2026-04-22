import type { ReviewRating, ReviewState } from "@/lib/app-types";

const DAY_MS = 24 * 60 * 60 * 1000;

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
  const easeFloor = 1.3;

  if (rating === "again") {
    const intervalDays = 30 / (24 * 60);
    return {
      dueAt: new Date(now.getTime() + intervalDays * DAY_MS).toISOString(),
      intervalDays,
      easeFactor: Math.max(easeFloor, reviewState.easeFactor - 0.2),
      repetitionCount: 0,
      lapseCount: reviewState.lapseCount + 1,
      lastReviewedAt: now.toISOString(),
    };
  }

  if (rating === "hard") {
    const intervalDays =
      reviewState.repetitionCount === 0
        ? 1
        : Math.max(1, Number((reviewState.intervalDays * 1.2).toFixed(2)));
    return {
      dueAt: new Date(now.getTime() + intervalDays * DAY_MS).toISOString(),
      intervalDays,
      easeFactor: Math.max(easeFloor, reviewState.easeFactor - 0.05),
      repetitionCount: reviewState.repetitionCount + 1,
      lapseCount: reviewState.lapseCount,
      lastReviewedAt: now.toISOString(),
    };
  }

  if (rating === "good") {
    const intervalDays =
      reviewState.repetitionCount === 0
        ? 1
        : Math.max(
            2,
            Number((reviewState.intervalDays * reviewState.easeFactor).toFixed(2)),
          );
    return {
      dueAt: new Date(now.getTime() + intervalDays * DAY_MS).toISOString(),
      intervalDays,
      easeFactor: reviewState.easeFactor,
      repetitionCount: reviewState.repetitionCount + 1,
      lapseCount: reviewState.lapseCount,
      lastReviewedAt: now.toISOString(),
    };
  }

  const intervalDays =
    reviewState.repetitionCount === 0
      ? 3
      : Math.max(
          4,
          Number(
            (reviewState.intervalDays * reviewState.easeFactor * 1.35).toFixed(2),
          ),
        );
  return {
    dueAt: new Date(now.getTime() + intervalDays * DAY_MS).toISOString(),
    intervalDays,
    easeFactor: reviewState.easeFactor + 0.15,
    repetitionCount: reviewState.repetitionCount + 1,
    lapseCount: reviewState.lapseCount,
    lastReviewedAt: now.toISOString(),
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

  if (intervalDays < 1) {
    return `${Math.max(1, Math.round(intervalDays * 24))}h`;
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
