import type { AppState, DictionaryEntry, VocabItem } from "@/lib/app-types";
import { searchDictionary } from "@/lib/mock-dictionary";
import { PLAN_LIMITS } from "@/lib/plan";
import { createInitialReviewState } from "@/lib/review";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export function normalizeQuery(query: string) {
  return query
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ");
}

export function createVocabItem(entry: DictionaryEntry, originalQuery: string) {
  const now = new Date();

  return {
    id: crypto.randomUUID(),
    originalQuery,
    canonicalTerm: entry.canonicalTerm,
    normalizedTerm: entry.normalizedTerm,
    partOfSpeech: entry.partOfSpeech,
    definition: entry.definition,
    exampleSentence: entry.exampleSentence,
    pronunciations: entry.pronunciations,
    notes: entry.notes,
    status: "active",
    searchCount: 1,
    lastSearchedAt: now.toISOString(),
    createdAt: now.toISOString(),
    reviewState: createInitialReviewState(now),
  } satisfies VocabItem;
}

function seedItem(
  query: string,
  options: {
    status?: VocabItem["status"];
    searchCount?: number;
    createdOffsetDays?: number;
    lastSearchedOffsetHours?: number;
    dueOffsetHours?: number;
    intervalDays?: number;
    easeFactor?: number;
    repetitionCount?: number;
    lapseCount?: number;
  },
) {
  const entry = searchDictionary(query);

  if (!entry) {
    throw new Error(`Missing preview dictionary entry for "${query}".`);
  }

  const now = Date.now();
  const createdAt = new Date(
    now - (options.createdOffsetDays ?? 0) * DAY_MS,
  ).toISOString();
  const lastSearchedAt = new Date(
    now - (options.lastSearchedOffsetHours ?? 2) * HOUR_MS,
  ).toISOString();
  const dueAt = new Date(now + (options.dueOffsetHours ?? 0) * HOUR_MS).toISOString();
  const lastReviewedAt = new Date(
    now - Math.max(1, Math.abs(options.dueOffsetHours ?? 0) + 8) * HOUR_MS,
  ).toISOString();

  return {
    id: `seed-${entry.normalizedTerm}`,
    originalQuery: query,
    canonicalTerm: entry.canonicalTerm,
    normalizedTerm: entry.normalizedTerm,
    partOfSpeech: entry.partOfSpeech,
    definition: entry.definition,
    exampleSentence: entry.exampleSentence,
    pronunciations: entry.pronunciations,
    notes: entry.notes,
    status: options.status ?? "active",
    searchCount: options.searchCount ?? 1,
    lastSearchedAt,
    createdAt,
    reviewState: {
      dueAt,
      intervalDays: options.intervalDays ?? 1,
      easeFactor: options.easeFactor ?? 2.5,
      repetitionCount: options.repetitionCount ?? 1,
      lapseCount: options.lapseCount ?? 0,
      lastReviewedAt,
    },
  } satisfies VocabItem;
}

export function createSeedState(): AppState {
  const now = new Date();

  return {
    planTier: "free",
    activeLimit: PLAN_LIMITS.free,
    items: [
      seedItem("meticulous", {
        searchCount: 4,
        createdOffsetDays: 9,
        lastSearchedOffsetHours: 3,
        dueOffsetHours: -7,
        intervalDays: 4,
        easeFactor: 2.62,
        repetitionCount: 4,
      }),
      seedItem("foster", {
        searchCount: 2,
        createdOffsetDays: 5,
        lastSearchedOffsetHours: 5,
        dueOffsetHours: 12,
        intervalDays: 2,
        easeFactor: 2.5,
        repetitionCount: 2,
      }),
      seedItem("nuance", {
        searchCount: 3,
        createdOffsetDays: 7,
        lastSearchedOffsetHours: 8,
        dueOffsetHours: -1,
        intervalDays: 3,
        easeFactor: 2.44,
        repetitionCount: 3,
        lapseCount: 1,
      }),
      seedItem("resilient", {
        status: "archived",
        searchCount: 1,
        createdOffsetDays: 12,
        lastSearchedOffsetHours: 26,
        dueOffsetHours: 36,
        intervalDays: 7,
        easeFactor: 2.68,
        repetitionCount: 5,
      }),
    ],
    reviewEvents: [
      {
        id: "seed-event-meticulous",
        vocabItemId: "seed-meticulous",
        rating: "good",
        reviewedAt: new Date(now.getTime() - 4 * HOUR_MS).toISOString(),
        previousDueAt: new Date(now.getTime() - 30 * HOUR_MS).toISOString(),
        newDueAt: new Date(now.getTime() - 7 * HOUR_MS).toISOString(),
      },
      {
        id: "seed-event-nuance",
        vocabItemId: "seed-nuance",
        rating: "hard",
        reviewedAt: new Date(now.getTime() - 2 * HOUR_MS).toISOString(),
        previousDueAt: new Date(now.getTime() - 26 * HOUR_MS).toISOString(),
        newDueAt: new Date(now.getTime() - 1 * HOUR_MS).toISOString(),
      },
    ],
  };
}
