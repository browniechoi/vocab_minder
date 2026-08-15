import type { DictionaryEntry } from "@/lib/app-types";
import { lookupMerriam } from "@/lib/merriam";
import { generateVocabEntry } from "@/lib/vocab-enrichment";

export type VocabLookupResult = {
  entry: DictionaryEntry | null;
  suggestions: string[];
};

export async function lookupVocab(
  query: string,
  forceExact = false,
): Promise<VocabLookupResult> {
  const merriamApiKey = process.env.MERRIAM_API_KEY;
  const [generatedResult, merriamResult] = await Promise.allSettled([
    generateVocabEntry(query),
    merriamApiKey
      ? lookupMerriam(query, merriamApiKey)
      : Promise.resolve({ entry: null, suggestions: [] }),
  ]);
  const generatedEntry =
    generatedResult.status === "fulfilled" ? generatedResult.value : null;
  const merriamLookup =
    merriamResult.status === "fulfilled"
      ? merriamResult.value
      : { entry: null, suggestions: [] };

  if (
    !forceExact &&
    !merriamLookup.entry &&
    merriamLookup.suggestions.length > 0
  ) {
    return {
      entry: null,
      suggestions: merriamLookup.suggestions,
    };
  }

  if (generatedEntry) {
    return {
      entry: {
        ...generatedEntry,
        pronunciations: merriamLookup.entry?.pronunciations ?? [],
      },
      suggestions: [],
    };
  }

  if (merriamLookup.entry) {
    return {
      entry: merriamLookup.entry,
      suggestions: [],
    };
  }

  if (generatedResult.status === "rejected") {
    throw generatedResult.reason;
  }
  if (merriamResult.status === "rejected") {
    throw merriamResult.reason;
  }

  return {
    entry: null,
    suggestions: forceExact ? [] : merriamLookup.suggestions,
  };
}
