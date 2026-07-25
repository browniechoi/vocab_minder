import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/route";
import {
  generateVocabEntry,
  OPENAI_VOCAB_PROMPT_VERSION,
} from "@/lib/vocab-enrichment";

const REGENERATION_BATCH_SIZE = 3;

type RegenerationRow = {
  canonical_term: string;
  id: string;
  original_query: string;
};

export async function POST(request: Request) {
  try {
    const { errorResponse, supabase, user } = await getAuthenticatedContext();
    if (errorResponse || !supabase || !user) {
      return errorResponse;
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { message: "OPENAI_API_KEY is not configured on the server." },
        { status: 503 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      retryFailed?: boolean;
    };
    if (body.retryFailed) {
      const { error: retryResetError } = await supabase
        .from("vocab_items")
        .update({
          content_generation_attempt_version: null,
        })
        .eq("user_id", user.id)
        .not("content_generation_error", "is", null);

      if (retryResetError) {
        return NextResponse.json(
          { message: retryResetError.message },
          { status: 500 },
        );
      }
    }

    const rowsQuery = supabase
      .from("vocab_items")
      .select("id, original_query, canonical_term")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(REGENERATION_BATCH_SIZE)
      .or(
        `content_provider.neq.openai,content_prompt_version.is.null,content_prompt_version.neq.${OPENAI_VOCAB_PROMPT_VERSION}`,
      )
      .or(
        `content_generation_attempt_version.is.null,content_generation_attempt_version.neq.${OPENAI_VOCAB_PROMPT_VERSION}`,
      );

    const { data: rows, error: rowsError } =
      await rowsQuery.returns<RegenerationRow[]>();
    if (rowsError) {
      return NextResponse.json(
        { message: rowsError.message },
        { status: 500 },
      );
    }

    const results = await Promise.all(
      (rows ?? []).map(async (row) => {
        const attemptedAt = new Date().toISOString();

        try {
          const generated = await generateVocabEntry(
            row.original_query || row.canonical_term,
          );
          if (!generated) {
            throw new Error("The model did not recognize this vocabulary item.");
          }

          const { error: updateError } = await supabase
            .from("vocab_items")
            .update({
              canonical_term: generated.canonicalTerm,
              normalized_term: generated.normalizedTerm,
              definition: generated.definition,
              definition_labels: generated.definitionLabels ?? [],
              grammatical_role: generated.grammaticalRole,
              usage_note: generated.usageNote,
              common_collocations: generated.commonCollocations,
              example_sentence: generated.exampleSentence,
              cloze_sentence: generated.clozeSentence,
              answer_lemma: generated.answerLemma,
              cloze_answer: generated.clozeAnswer,
              accepted_answers: generated.acceptedAnswers,
              word_family_key: generated.wordFamilyKey,
              sense_key: generated.senseKey,
              part_of_speech: generated.partOfSpeech,
              notes: generated.notes ?? null,
              dictionary_source: "openai",
              content_provider: "openai",
              content_model: generated.contentModel ?? null,
              content_prompt_version: OPENAI_VOCAB_PROMPT_VERSION,
              content_generated_at: generated.contentGeneratedAt ?? attemptedAt,
              content_edited_at: null,
              content_generation_attempt_version:
                OPENAI_VOCAB_PROMPT_VERSION,
              content_generation_attempted_at: attemptedAt,
              content_generation_error: null,
            })
            .eq("user_id", user.id)
            .eq("id", row.id);

          if (updateError) {
            throw updateError;
          }

          return { id: row.id, success: true as const };
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message.slice(0, 500)
              : "Vocabulary regeneration failed.";
          await supabase
            .from("vocab_items")
            .update({
              content_generation_attempt_version:
                OPENAI_VOCAB_PROMPT_VERSION,
              content_generation_attempted_at: attemptedAt,
              content_generation_error: message,
            })
            .eq("user_id", user.id)
            .eq("id", row.id);

          return {
            id: row.id,
            message,
            success: false as const,
          };
        }
      }),
    );

    return NextResponse.json({
      attempted: results.length,
      failed: results.filter((result) => !result.success),
      hasMore: results.length === REGENERATION_BATCH_SIZE,
      regenerated: results.filter((result) => result.success).length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Vocabulary regeneration failed unexpectedly.",
      },
      { status: 500 },
    );
  }
}
