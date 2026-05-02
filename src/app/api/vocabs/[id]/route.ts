import { NextResponse } from "next/server";
import { normalizeDefinitionLabels } from "@/lib/definition-labels";
import {
  VOCAB_ROW_SELECT,
  mapVocabRowToPersistedItem,
  type VocabRow,
} from "@/lib/persisted-state";
import { getAuthenticatedContext } from "@/lib/supabase/route";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { errorResponse, supabase } = await getAuthenticatedContext();
    if (errorResponse || !supabase) {
      return errorResponse;
    }

    const { id } = await params;
    const body = (await request.json()) as {
      definition?: string;
      definitionLabels?: unknown;
      exampleSentence?: string;
    };
    const definition = body.definition?.trim() ?? "";
    const exampleSentence = body.exampleSentence?.trim() ?? "";

    if (!definition) {
      return NextResponse.json(
        { message: "Definition is required." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("vocab_items")
      .update({
        definition,
        definition_labels: normalizeDefinitionLabels(body.definitionLabels),
        example_sentence: exampleSentence || null,
      })
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
          error instanceof Error ? error.message : "Update failed unexpectedly.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { errorResponse, supabase } = await getAuthenticatedContext();
    if (errorResponse || !supabase) {
      return errorResponse;
    }

    const { id } = await params;

    const { error } = await supabase.from("vocab_items").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Delete failed unexpectedly.",
      },
      { status: 500 },
    );
  }
}
