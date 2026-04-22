import { NextResponse } from "next/server";
import { mapProfileRowToState, mapVocabRowToPersistedItem } from "@/lib/persisted-state";
import { getAuthenticatedContext } from "@/lib/supabase/route";

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

    return NextResponse.json({
      items: (data ?? []).map(mapVocabRowToPersistedItem),
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
