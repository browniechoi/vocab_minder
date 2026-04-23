import { NextResponse } from "next/server";
import type { ReviewRating } from "@/lib/app-types";
import { applyReview } from "@/lib/review";
import { getAuthenticatedContext } from "@/lib/supabase/route";
import {
  createFallbackReviewState,
  fetchCardForVocabItem,
  fetchReviewStateForCard,
} from "@/lib/supabase/review-data";

const VALID_RATINGS = new Set<ReviewRating>(["again", "hard", "good", "easy"]);

type VocabTimingRow = {
  created_at: string;
};

export async function POST(request: Request) {
  try {
    const { errorResponse, supabase, user } = await getAuthenticatedContext();
    if (errorResponse || !supabase || !user) {
      return errorResponse;
    }

    const body = (await request.json()) as {
      rating?: ReviewRating;
      vocabItemId?: string;
    };

    if (!body.vocabItemId || !body.rating || !VALID_RATINGS.has(body.rating)) {
      return NextResponse.json(
        { message: "A vocab item id and valid rating are required." },
        { status: 400 },
      );
    }

    const { data: vocabRow, error: vocabError } = await supabase
      .from("vocab_items")
      .select("created_at")
      .eq("user_id", user.id)
      .eq("id", body.vocabItemId)
      .single<VocabTimingRow>();

    if (vocabError) {
      return NextResponse.json({ message: vocabError.message }, { status: 500 });
    }

    const card = await fetchCardForVocabItem(supabase, user.id, body.vocabItemId);
    if (!card) {
      return NextResponse.json(
        {
          message:
            "Review card is not initialized for this vocab item. Apply the latest migration and reload.",
        },
        { status: 409 },
      );
    }

    const currentReviewState =
      (await fetchReviewStateForCard(supabase, card.id)) ??
      createFallbackReviewState(vocabRow.created_at);

    const reviewedAt = new Date();
    const reviewedIso = reviewedAt.toISOString();
    const nextReviewState = applyReview(currentReviewState, body.rating, reviewedAt);

    const { error: reviewStateError } = await supabase
      .from("review_states")
      .upsert(
        {
          card_id: card.id,
          due_at: nextReviewState.dueAt,
          interval_days: nextReviewState.intervalDays,
          ease_factor: nextReviewState.easeFactor,
          repetition_count: nextReviewState.repetitionCount,
          lapse_count: nextReviewState.lapseCount,
          last_reviewed_at: nextReviewState.lastReviewedAt,
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
        card_id: card.id,
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
      reviewState: nextReviewState,
      reviewEvent: {
        id: reviewEventRow.id,
        vocabItemId: body.vocabItemId,
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
