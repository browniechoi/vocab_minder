import type { DictionaryEntry } from "@/lib/app-types";
import { lookupMerriamEntry } from "@/lib/merriam";
import { generateVocabEntry } from "@/lib/vocab-enrichment";

export async function lookupVocabEntry(
  query: string,
): Promise<DictionaryEntry | null> {
  const merriamApiKey = process.env.MERRIAM_API_KEY;
  const [generatedResult, merriamResult] = await Promise.allSettled([
    generateVocabEntry(query),
    merriamApiKey
      ? lookupMerriamEntry(query, merriamApiKey)
      : Promise.resolve(null),
  ]);
  const generatedEntry =
    generatedResult.status === "fulfilled" ? generatedResult.value : null;
  const merriamEntry =
    merriamResult.status === "fulfilled" ? merriamResult.value : null;

  if (generatedEntry) {
    return {
      ...generatedEntry,
      pronunciations: merriamEntry?.pronunciations ?? [],
    };
  }

  if (
    process.env.OPENAI_API_KEY &&
    generatedResult.status === "rejected"
  ) {
    throw generatedResult.reason;
  }

  if (merriamEntry) {
    return merriamEntry;
  }

  if (generatedResult.status === "rejected") {
    throw generatedResult.reason;
  }
  if (merriamResult.status === "rejected") {
    throw merriamResult.reason;
  }

  return null;
}
