import { NextResponse } from "next/server";
import { mapVocabRowToPersistedItem } from "@/lib/persisted-state";
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

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { errorResponse, supabase } = await getAuthenticatedContext();
    if (errorResponse || !supabase) {
      return errorResponse;
    }

    const { id } = await params;
    const { data, error } = await supabase
      .from("vocab_items")
      .update({ status: "archived" })
      .eq("id", id)
      .select(
        "id, original_query, canonical_term, normalized_term, definition, example_sentence, part_of_speech, pronunciations, notes, status, search_count, last_searched_at, created_at",
      )
      .single<VocabRow>();

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({ vocab: mapVocabRowToPersistedItem(data) });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Archive failed unexpectedly.",
      },
      { status: 500 },
    );
  }
}
