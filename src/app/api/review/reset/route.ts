import { NextResponse } from "next/server";
import { createInitialReviewState } from "@/lib/review";
import { getAuthenticatedContext } from "@/lib/supabase/route";
import { fetchCardsForUser } from "@/lib/supabase/review-data";

type VocabResetRow = {
  created_at: string;
  id: string;
};

export async function POST() {
  try {
    const { errorResponse, supabase, user } = await getAuthenticatedContext();
    if (errorResponse || !supabase || !user) {
      return errorResponse;
    }

    const [{ data: vocabRows, error: vocabError }, cards] = await Promise.all([
      supabase
        .from("vocab_items")
        .select("id, created_at")
        .eq("user_id", user.id)
        .returns<VocabResetRow[]>(),
      fetchCardsForUser(supabase, user.id),
    ]);

    if (vocabError) {
      return NextResponse.json({ message: vocabError.message }, { status: 500 });
    }

    const createdAtByVocabId = new Map(
      (vocabRows ?? []).map((row) => [row.id, row.created_at]),
    );

    for (const card of cards) {
      const createdAt = createdAtByVocabId.get(card.vocab_item_id);
      if (!createdAt) {
        continue;
      }

      const initialState = createInitialReviewState(new Date(createdAt));
      const { error } = await supabase.from("review_states").upsert(
        {
          card_id: card.id,
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
        },
        { onConflict: "card_id" },
      );

      if (error) {
        return NextResponse.json({ message: error.message }, { status: 500 });
      }
    }

    const { error: deleteEventsError } = await supabase
      .from("review_events")
      .delete()
      .eq("user_id", user.id);

    if (deleteEventsError) {
      return NextResponse.json(
        { message: deleteEventsError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Review reset failed unexpectedly.",
      },
      { status: 500 },
    );
  }
}
