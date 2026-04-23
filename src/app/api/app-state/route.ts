import { NextResponse } from "next/server";
import { attachReviewState, mapProfileRowToState, mapVocabRowToPersistedItem, type VocabRow } from "@/lib/persisted-state";
import { getAuthenticatedContext } from "@/lib/supabase/route";
import {
  createFallbackReviewState,
  fetchReviewHydrationForUser,
} from "@/lib/supabase/review-data";

export async function GET() {
  try {
    const { errorResponse, profile, supabase, user } =
      await getAuthenticatedContext();

    if (errorResponse || !profile || !supabase || !user) {
      return errorResponse;
    }

    const { data, error } = await supabase
      .from("vocab_items")
      .select(
        "id, original_query, canonical_term, normalized_term, definition, example_sentence, part_of_speech, pronunciations, notes, status, search_count, last_searched_at, created_at",
      )
      .eq("user_id", user.id)
      .order("last_searched_at", { ascending: false })
      .returns<VocabRow[]>();

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    const { reviewEvents, reviewStatesByVocabItemId } =
      await fetchReviewHydrationForUser(supabase, user.id);

    return NextResponse.json({
      items: (data ?? []).map((row) => {
        const persisted = mapVocabRowToPersistedItem(row);
        return attachReviewState(
          persisted,
          reviewStatesByVocabItemId.get(row.id) ??
            createFallbackReviewState(row.created_at),
        );
      }),
      reviewEvents,
      profile: mapProfileRowToState(profile),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Failed to load app state.",
      },
      { status: 500 },
    );
  }
}
