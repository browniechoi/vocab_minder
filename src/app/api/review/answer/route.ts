import { NextResponse } from "next/server";
import type { ReviewRating } from "@/lib/app-types";
import { applyReview, shouldUnlockProduction } from "@/lib/review";
import { getAuthenticatedContext } from "@/lib/supabase/route";
import {
  createFallbackReviewState,
  ensureCardForVocabItem,
  ensureReviewStateForCard,
} from "@/lib/supabase/review-data";

const VALID_RATINGS = new Set<ReviewRating>(["again", "hard", "good", "easy"]);

type VocabTimingRow = {
  canonical_term: string;
  created_at: string;
  definition: string;
  status: "active" | "archived";
};

type ReviewCardRow = {
  id: string;
  card_type: "recognition" | "production" | "listening";
  is_active: boolean;
  vocab_item_id: string;
};

export async function POST(request: Request) {
  try {
    const { errorResponse, supabase, user } = await getAuthenticatedContext();
    if (errorResponse || !supabase || !user) {
      return errorResponse;
    }

    const body = (await request.json()) as {
      cardId?: string;
      rating?: ReviewRating;
      vocabItemId?: string;
    };

    if (!body.cardId || !body.rating || !VALID_RATINGS.has(body.rating)) {
      return NextResponse.json(
        { message: "A review card id and valid rating are required." },
        { status: 400 },
      );
    }

    const { data: cardRow, error: cardError } = await supabase
      .from("cards")
      .select("id, vocab_item_id, card_type, is_active")
      .eq("user_id", user.id)
      .eq("id", body.cardId)
      .single<ReviewCardRow>();

    if (cardError) {
      return NextResponse.json({ message: cardError.message }, { status: 500 });
    }

    const { data: vocabRow, error: vocabError } = await supabase
      .from("vocab_items")
      .select("canonical_term, created_at, definition, status")
      .eq("user_id", user.id)
      .eq("id", cardRow.vocab_item_id)
      .single<VocabTimingRow>();

    if (vocabError) {
      return NextResponse.json({ message: vocabError.message }, { status: 500 });
    }

    const card = await ensureCardForVocabItem(supabase, user.id, {
      canonicalTerm: vocabRow.canonical_term,
      definition: vocabRow.definition,
      status: vocabRow.status,
      vocabItemId: cardRow.vocab_item_id,
    }, cardRow.card_type);
    const activeCard = {
      ...card,
      card_type: cardRow.card_type,
      is_active: cardRow.is_active,
    };
    const currentReviewState =
      (await ensureReviewStateForCard(
        supabase,
        activeCard.id,
        vocabRow.created_at,
      )) ?? createFallbackReviewState(vocabRow.created_at);

    const reviewedAt = new Date();
    const reviewedIso = reviewedAt.toISOString();
    const nextReviewState = applyReview(currentReviewState, body.rating, reviewedAt);
    let unlockedCard:
      | {
          id: string;
          vocabItemId: string;
          cardType: "recognition" | "production" | "listening";
          isActive: boolean;
          reviewState: typeof nextReviewState;
        }
      | undefined;

    if (
      activeCard.card_type === "recognition" &&
      shouldUnlockProduction(nextReviewState)
    ) {
      const productionCard = await ensureCardForVocabItem(
        supabase,
        user.id,
        {
          canonicalTerm: vocabRow.canonical_term,
          definition: vocabRow.definition,
          status: vocabRow.status,
          vocabItemId: cardRow.vocab_item_id,
        },
        "production",
      );
      const productionReviewState =
        (await ensureReviewStateForCard(
          supabase,
          productionCard.id,
          reviewedIso,
        )) ?? createFallbackReviewState(reviewedIso);

      unlockedCard = {
        id: productionCard.id,
        vocabItemId: productionCard.vocab_item_id,
        cardType: productionCard.card_type,
        isActive: productionCard.is_active,
        reviewState: productionReviewState,
      };
    }

    const { error: reviewStateError } = await supabase
      .from("review_states")
      .upsert(
        {
          card_id: activeCard.id,
          due_at: nextReviewState.dueAt,
          interval_days: nextReviewState.intervalDays,
          ease_factor: nextReviewState.easeFactor,
          repetition_count: nextReviewState.repetitionCount,
          lapse_count: nextReviewState.lapseCount,
          last_reviewed_at: nextReviewState.lastReviewedAt,
          stability_days: nextReviewState.stabilityDays,
          difficulty: nextReviewState.difficulty,
          fsrs_state: nextReviewState.fsrsState,
          learning_steps: nextReviewState.learningSteps,
          desired_retention: nextReviewState.desiredRetention,
        },
        { onConflict: "card_id" },
      );

    if (reviewStateError) {
      return NextResponse.json(
        { message: reviewStateError.message },
        { status: 500 },
      );
    }

    const { data: reviewEventRow, error: reviewEventError } = await supabase
      .from("review_events")
      .insert({
        user_id: user.id,
        card_id: activeCard.id,
        rating: body.rating,
        reviewed_at: reviewedIso,
        previous_due_at: currentReviewState.dueAt,
        new_due_at: nextReviewState.dueAt,
      })
      .select("id")
      .single<{ id: string }>();

    if (reviewEventError) {
      return NextResponse.json(
        { message: reviewEventError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      reviewCard: {
        id: activeCard.id,
        vocabItemId: activeCard.vocab_item_id,
        cardType: activeCard.card_type,
        isActive: activeCard.is_active,
        reviewState: nextReviewState,
      },
      unlockedCard,
      reviewEvent: {
        id: reviewEventRow.id,
        cardId: activeCard.id,
        cardType: activeCard.card_type,
        vocabItemId: activeCard.vocab_item_id,
        rating: body.rating,
        reviewedAt: reviewedIso,
        previousDueAt: currentReviewState.dueAt,
        newDueAt: nextReviewState.dueAt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Review answer failed unexpectedly.",
      },
      { status: 500 },
    );
  }
}
