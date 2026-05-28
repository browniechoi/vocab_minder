import type {
  ReviewCard,
  ReviewCardType,
  ReviewEvent,
  ReviewState,
} from "@/lib/app-types";
import {
  type CardRow,
  type ReviewEventRow,
  type ReviewStateRow,
  mapReviewCardRow,
  mapReviewEventRow,
  mapReviewStateRow,
} from "@/lib/persisted-state";
import { createInitialReviewState } from "@/lib/review";
import { createClient } from "@/lib/supabase/server";

type SupabaseRouteClient = Awaited<ReturnType<typeof createClient>>;

export async function fetchCardsForUser(
  supabase: SupabaseRouteClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("cards")
    .select("id, vocab_item_id, card_type, is_active")
    .eq("user_id", userId)
    .returns<CardRow[]>();

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function fetchCardForVocabItem(
  supabase: SupabaseRouteClient,
  userId: string,
  vocabItemId: string,
  cardType: ReviewCardType = "recognition",
) {
  const { data, error } = await supabase
    .from("cards")
    .select("id, vocab_item_id, card_type, is_active")
    .eq("user_id", userId)
    .eq("vocab_item_id", vocabItemId)
    .eq("card_type", cardType)
    .limit(1)
    .returns<CardRow[]>();

  if (error) {
    throw error;
  }

  return data?.[0] ?? null;
}

export async function fetchReviewStateForCard(
  supabase: SupabaseRouteClient,
  cardId: string,
) {
  const { data, error } = await supabase
    .from("review_states")
    .select(
      "card_id, due_at, interval_days, ease_factor, repetition_count, lapse_count, last_reviewed_at, stability_days, difficulty, fsrs_state, learning_steps, desired_retention",
    )
    .eq("card_id", cardId)
    .maybeSingle<ReviewStateRow>();

  if (error) {
    throw error;
  }

  return data ? mapReviewStateRow(data) : null;
}

export async function fetchReviewHydrationForUser(
  supabase: SupabaseRouteClient,
  userId: string,
) {
  const cards = await fetchCardsForUser(supabase, userId);
  const cardIds = cards.map((card) => card.id);

  if (cardIds.length === 0) {
    return {
      reviewEvents: [] as ReviewEvent[],
      reviewCards: [] as ReviewCard[],
      reviewStatesByVocabItemId: new Map<string, ReviewState>(),
    };
  }

  const [{ data: reviewStateRows, error: reviewStatesError }, { data: reviewEventRows, error: reviewEventsError }] =
    await Promise.all([
      supabase
        .from("review_states")
        .select(
          "card_id, due_at, interval_days, ease_factor, repetition_count, lapse_count, last_reviewed_at, stability_days, difficulty, fsrs_state, learning_steps, desired_retention",
        )
        .in("card_id", cardIds)
        .returns<ReviewStateRow[]>(),
      supabase
        .from("review_events")
        .select(
          "id, card_id, rating, reviewed_at, previous_due_at, new_due_at",
        )
        .eq("user_id", userId)
        .in("card_id", cardIds)
        .order("reviewed_at", { ascending: false })
        .limit(100)
        .returns<ReviewEventRow[]>(),
    ]);

  if (reviewStatesError) {
    throw reviewStatesError;
  }

  if (reviewEventsError) {
    throw reviewEventsError;
  }

  const vocabItemIdByCardId = new Map(
    cards.map((card) => [card.id, card.vocab_item_id]),
  );
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const reviewStatesByVocabItemId = new Map<string, ReviewState>();
  const reviewStatesByCardId = new Map<string, ReviewState>();

  for (const row of reviewStateRows ?? []) {
    const vocabItemId = vocabItemIdByCardId.get(row.card_id);
    if (!vocabItemId) {
      continue;
    }

    const reviewState = mapReviewStateRow(row);
    reviewStatesByCardId.set(row.card_id, reviewState);

    const card = cardById.get(row.card_id);
    if (card?.card_type === "recognition") {
      reviewStatesByVocabItemId.set(vocabItemId, reviewState);
    }
  }

  const reviewCards = cards.map((card) =>
    mapReviewCardRow(
      card,
      reviewStatesByCardId.get(card.id) ??
        createFallbackReviewState(new Date().toISOString()),
    ),
  );

  const reviewEvents = (reviewEventRows ?? []).flatMap((row) => {
    const vocabItemId = vocabItemIdByCardId.get(row.card_id);
    if (!vocabItemId) {
      return [];
    }

    return [mapReviewEventRow(row, vocabItemId, cardById.get(row.card_id)?.card_type)];
  });

  return {
    reviewEvents,
    reviewCards,
    reviewStatesByVocabItemId,
  };
}

export function createFallbackReviewState(createdAt: string) {
  return createInitialReviewState(new Date(createdAt));
}

export async function ensureCardForVocabItem(
  supabase: SupabaseRouteClient,
  userId: string,
  seed: {
    canonicalTerm: string;
    definition: string;
    status: "active" | "archived";
    vocabItemId: string;
  },
  cardType: ReviewCardType = "recognition",
) {
  const existing = await fetchCardForVocabItem(
    supabase,
    userId,
    seed.vocabItemId,
    cardType,
  );
  if (existing) {
    return existing;
  }

  const { data, error } = await supabase
    .from("cards")
    .insert({
      user_id: userId,
      vocab_item_id: seed.vocabItemId,
      card_type: cardType,
      front_text:
        cardType === "production" ? seed.definition : seed.canonicalTerm,
      back_text:
        cardType === "production" ? seed.canonicalTerm : seed.definition,
      is_active: seed.status === "active",
    })
    .select("id, vocab_item_id, card_type, is_active")
    .single<CardRow>();

  if (error) {
    throw error;
  }

  return data;
}

export async function ensureReviewStateForCard(
  supabase: SupabaseRouteClient,
  cardId: string,
  createdAt: string,
) {
  const existing = await fetchReviewStateForCard(supabase, cardId);
  if (existing) {
    return existing;
  }

  const initialState = createFallbackReviewState(createdAt);
  const { error } = await supabase.from("review_states").insert({
    card_id: cardId,
    due_at: initialState.dueAt,
    interval_days: initialState.intervalDays,
    ease_factor: initialState.easeFactor,
    repetition_count: initialState.repetitionCount,
    lapse_count: initialState.lapseCount,
    last_reviewed_at: initialState.lastReviewedAt,
    stability_days: initialState.stabilityDays,
    difficulty: initialState.difficulty,
    fsrs_state: initialState.fsrsState,
    learning_steps: initialState.learningSteps,
    desired_retention: initialState.desiredRetention,
  });

  if (error) {
    throw error;
  }

  return initialState;
}
