import { NextResponse } from "next/server";
import {
  VOCAB_ROW_SELECT,
  mapVocabRowToPersistedItem,
  type VocabRow,
} from "@/lib/persisted-state";
import { getAuthenticatedContext } from "@/lib/supabase/route";

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
      .select(VOCAB_ROW_SELECT)
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
