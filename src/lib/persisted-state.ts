import type {
  AppState,
  PersistedVocabItem,
  PlanTier,
  ProfileState,
  Pronunciation,
  ReviewCard,
  ReviewCardType,
  ReviewEvent,
  ReviewCache,
  ReviewMemoryState,
  ReviewRating,
  ReviewState,
  VocabContentProvider,
  VocabItem,
} from "@/lib/app-types";
import {
  normalizeDefinitionLabels,
  splitInlineDefinitionLabels,
} from "@/lib/definition-labels";
import { PLAN_LIMITS } from "@/lib/plan";
import { normalizeReviewState } from "@/lib/review";

export type ProfileRow = {
  plan_tier: PlanTier;
  active_vocab_limit: number;
};

export type VocabRow = {
  id: string;
  original_query: string;
  canonical_term: string;
  normalized_term: string;
  definition: string;
  definition_labels?: unknown;
  example_sentence: string | null;
  cloze_sentence?: string | null;
  answer_lemma?: string | null;
  cloze_answer?: string | null;
  accepted_answers?: unknown;
  part_of_speech: string | null;
  pronunciations: unknown;
  notes: string | null;
  content_provider?: string | null;
  content_model?: string | null;
  content_prompt_version?: string | null;
  content_generated_at?: string | null;
  content_edited_at?: string | null;
  status: "active" | "archived";
  search_count: number;
  last_searched_at: string;
  created_at: string;
};

export const VOCAB_ROW_SELECT =
  "id, original_query, canonical_term, normalized_term, definition, definition_labels, example_sentence, cloze_sentence, answer_lemma, cloze_answer, accepted_answers, part_of_speech, pronunciations, notes, content_provider, content_model, content_prompt_version, content_generated_at, content_edited_at, status, search_count, last_searched_at, created_at";

export type CardRow = {
  id: string;
  card_type: ReviewCardType;
  is_active: boolean;
  vocab_item_id: string;
};

export type ReviewStateRow = {
  card_id: string;
  desired_retention?: number | string | null;
  difficulty?: number | string | null;
  due_at: string;
  fsrs_state?: ReviewMemoryState | null;
  interval_days: number | string;
  ease_factor: number | string;
  learning_steps?: number | null;
  repetition_count: number;
  lapse_count: number;
  last_reviewed_at: string | null;
  stability_days?: number | string | null;
};

export type ReviewEventRow = {
  id: string;
  card_id: string;
  card_type?: ReviewCardType;
  rating: ReviewRating;
  reviewed_at: string;
  previous_due_at: string;
  new_due_at: string;
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

function normalizeStoredAnswers(value: unknown, fallback: string) {
  const answers = Array.isArray(value)
    ? value.flatMap((item) =>
        typeof item === "string" && item.trim() ? [item.trim()] : [],
      )
    : [];

  return answers.length > 0 ? [...new Set(answers)] : [fallback];
}

function normalizeContentProvider(value: unknown): VocabContentProvider {
  return value === "openai" || value === "manual"
    ? value
    : "merriam_webster";
}

export function createEmptyState(): AppState {
  return {
    planTier: "free",
    activeLimit: PLAN_LIMITS.free,
    items: [],
    reviewCards: [],
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
  const storedLabels = normalizeDefinitionLabels(row.definition_labels);
  const fallbackDefinitionParts = splitInlineDefinitionLabels(row.definition);
  const definitionLabels =
    storedLabels.length > 0 ? storedLabels : fallbackDefinitionParts.definitionLabels;
  const answerLemma =
    row.answer_lemma?.trim() || row.canonical_term.replace(/:\d+$/u, "");
  const clozeAnswer = row.cloze_answer?.trim() || answerLemma;

  return {
    id: row.id,
    originalQuery: row.original_query,
    canonicalTerm: row.canonical_term,
    normalizedTerm: row.normalized_term,
    partOfSpeech: row.part_of_speech ?? "unknown",
    definition:
      storedLabels.length > 0 ? row.definition : fallbackDefinitionParts.definition,
    definitionLabels,
    exampleSentence:
      row.example_sentence ?? "No example sentence available in this entry.",
    clozeSentence:
      row.cloze_sentence ?? `Use this word in context: _____.`,
    answerLemma,
    clozeAnswer,
    acceptedAnswers: normalizeStoredAnswers(row.accepted_answers, answerLemma),
    pronunciations: normalizePronunciations(row.pronunciations),
    notes: row.notes ?? undefined,
    contentProvider: normalizeContentProvider(row.content_provider),
    contentModel: row.content_model ?? undefined,
    contentPromptVersion: row.content_prompt_version ?? undefined,
    contentGeneratedAt: row.content_generated_at ?? undefined,
    contentEditedAt: row.content_edited_at ?? undefined,
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
    reviewState: normalizeReviewState(reviewState, new Date(vocab.createdAt)),
  };
}

export function mergePersistedItemsWithReviewCache(
  items: PersistedVocabItem[],
  reviewCache: ReviewCache,
): VocabItem[] {
  return items.map((item) =>
    attachReviewState(
      item,
      reviewCache.reviewCards.find(
        (card) =>
          card.vocabItemId === item.id && card.cardType === "recognition",
      )?.reviewState,
    ),
  );
}

export function mapReviewStateRow(row: ReviewStateRow): ReviewState {
  return normalizeReviewState({
    dueAt: row.due_at,
    intervalDays: Number(row.interval_days),
    easeFactor: Number(row.ease_factor),
    repetitionCount: row.repetition_count,
    lapseCount: row.lapse_count,
    lastReviewedAt: row.last_reviewed_at,
    stabilityDays: Number(row.stability_days ?? 0),
    difficulty: Number(row.difficulty ?? row.ease_factor ?? 0),
    fsrsState: row.fsrs_state ?? "New",
    learningSteps: row.learning_steps ?? 0,
    desiredRetention: Number(row.desired_retention ?? 0.92),
  });
}

export function mapReviewCardRow(
  row: CardRow,
  reviewState: ReviewState,
): ReviewCard {
  return {
    id: row.id,
    vocabItemId: row.vocab_item_id,
    cardType: row.card_type,
    isActive: row.is_active,
    reviewState: normalizeReviewState(reviewState),
  };
}

export function mapReviewEventRow(
  row: ReviewEventRow,
  vocabItemId: string,
  cardType?: ReviewCardType,
): ReviewEvent {
  return {
    id: row.id,
    cardId: row.card_id,
    cardType: row.card_type ?? cardType,
    vocabItemId,
    rating: row.rating,
    reviewedAt: row.reviewed_at,
    previousDueAt: row.previous_due_at,
    newDueAt: row.new_due_at,
  };
}

export function buildReviewCache(state: AppState): ReviewCache {
  return {
    reviewCards: state.reviewCards,
    reviewEvents: state.reviewEvents,
  };
}
