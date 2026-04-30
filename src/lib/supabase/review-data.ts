import type { ReviewEvent, ReviewState } from "@/lib/app-types";
import {
  type CardRow,
  type ReviewEventRow,
  type ReviewStateRow,
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
    .select("id, vocab_item_id")
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
) {
  const { data, error } = await supabase
    .from("cards")
    .select("id, vocab_item_id")
    .eq("user_id", userId)
    .eq("vocab_item_id", vocabItemId)
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
      "card_id, due_at, interval_days, ease_factor, repetition_count, lapse_count, last_reviewed_at",
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
      reviewStatesByVocabItemId: new Map<string, ReviewState>(),
    };
  }

  const [{ data: reviewStateRows, error: reviewStatesError }, { data: reviewEventRows, error: reviewEventsError }] =
    await Promise.all([
      supabase
        .from("review_states")
        .select(
          "card_id, due_at, interval_days, ease_factor, repetition_count, lapse_count, last_reviewed_at",
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
  const reviewStatesByVocabItemId = new Map<string, ReviewState>();

  for (const row of reviewStateRows ?? []) {
    const vocabItemId = vocabItemIdByCardId.get(row.card_id);
    if (!vocabItemId) {
      continue;
    }

    reviewStatesByVocabItemId.set(vocabItemId, mapReviewStateRow(row));
  }

  const reviewEvents = (reviewEventRows ?? []).flatMap((row) => {
    const vocabItemId = vocabItemIdByCardId.get(row.card_id);
    if (!vocabItemId) {
      return [];
    }

    return [mapReviewEventRow(row, vocabItemId)];
  });

  return {
    reviewEvents,
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
) {
  const existing = await fetchCardForVocabItem(supabase, userId, seed.vocabItemId);
  if (existing) {
    return existing;
  }

  const { data, error } = await supabase
    .from("cards")
    .insert({
      user_id: userId,
      vocab_item_id: seed.vocabItemId,
      front_text: seed.canonicalTerm,
      back_text: seed.definition,
      is_active: seed.status === "active",
    })
    .select("id, vocab_item_id")
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
  });

  if (error) {
    throw error;
  }

  return initialState;
}
