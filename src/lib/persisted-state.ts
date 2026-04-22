import type {
  AppState,
  PersistedVocabItem,
  PlanTier,
  ProfileState,
  Pronunciation,
  ReviewCache,
  ReviewState,
  VocabItem,
} from "@/lib/app-types";
import { PLAN_LIMITS } from "@/lib/plan";
import { createInitialReviewState } from "@/lib/review";

type ProfileRow = {
  plan_tier: PlanTier;
  active_vocab_limit: number;
};

type VocabRow = {
  id: string;
  original_query: string;
  canonical_term: string;
  normalized_term: string;
  definition: string;
  example_sentence: string | null;
  part_of_speech: string | null;
  pronunciations: unknown;
  notes: string | null;
  status: "active" | "archived";
  search_count: number;
  last_searched_at: string;
  created_at: string;
};

function normalizePronunciations(value: unknown): Pronunciation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) {
      return [];
    }

    const pronunciation = item as Partial<Pronunciation>;
    if (pronunciation.source !== "merriam") {
      return [];
    }

    return [
      {
        text:
          typeof pronunciation.text === "string"
            ? pronunciation.text
            : undefined,
        ipa:
          typeof pronunciation.ipa === "string" ? pronunciation.ipa : undefined,
        audioUrl:
          typeof pronunciation.audioUrl === "string"
            ? pronunciation.audioUrl
            : undefined,
        source: "merriam",
      } satisfies Pronunciation,
    ];
  });
}

export function createEmptyState(): AppState {
  return {
    planTier: "free",
    activeLimit: PLAN_LIMITS.free,
    items: [],
    reviewEvents: [],
  };
}

export function mapProfileRowToState(profile: ProfileRow | null): ProfileState {
  return {
    planTier: profile?.plan_tier ?? "free",
    activeLimit: profile?.active_vocab_limit ?? PLAN_LIMITS.free,
  };
}

export function mapVocabRowToPersistedItem(row: VocabRow): PersistedVocabItem {
  return {
    id: row.id,
    originalQuery: row.original_query,
    canonicalTerm: row.canonical_term,
    normalizedTerm: row.normalized_term,
    partOfSpeech: row.part_of_speech ?? "unknown",
    definition: row.definition,
    exampleSentence:
      row.example_sentence ?? "No example sentence available in this entry.",
    pronunciations: normalizePronunciations(row.pronunciations),
    notes: row.notes ?? undefined,
    status: row.status,
    searchCount: row.search_count,
    lastSearchedAt: row.last_searched_at,
    createdAt: row.created_at,
  };
}

export function attachReviewState(
  vocab: PersistedVocabItem,
  reviewState?: ReviewState | null,
): VocabItem {
  return {
    ...vocab,
    reviewState: reviewState ?? createInitialReviewState(new Date(vocab.createdAt)),
  };
}

export function mergePersistedItemsWithReviewCache(
  items: PersistedVocabItem[],
  reviewCache: ReviewCache,
): VocabItem[] {
  return items.map((item) =>
    attachReviewState(item, reviewCache.reviewStates[item.id]),
  );
}

export function buildReviewCache(state: AppState): ReviewCache {
  return {
    reviewStates: Object.fromEntries(
      state.items.map((item) => [item.id, item.reviewState]),
    ),
    reviewEvents: state.reviewEvents,
  };
}
