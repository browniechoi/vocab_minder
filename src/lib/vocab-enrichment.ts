import type { DictionaryEntry } from "@/lib/app-types";
import { buildClozeFromAnswer } from "@/lib/cloze";
import {
  AI_VOCAB_PROMPT_VERSION,
  getGenerationAttemptVersion,
  type GeneratedVocabContent,
} from "@/lib/vocab-generation-contract";
import {
  type Environment,
  generateVocabContent,
  getVocabGenerationTarget,
  isVocabGenerationConfigured,
} from "@/lib/vocab-generators";

export {
  AI_VOCAB_PROMPT_VERSION,
  getVocabGenerationTarget,
  isVocabGenerationConfigured,
};

function clampText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeTerm(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildWordFamilyKey(lemma: string) {
  return normalizeTerm(lemma).replace(/\s+/g, "-");
}

function normalizeStringArray(
  value: unknown,
  maxItems: number,
  maxItemLength: number,
) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const item of value) {
    const text = clampText(item, maxItemLength);
    const key = normalizeTerm(text);
    if (!text || !key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(text);
    if (normalized.length >= maxItems) {
      break;
    }
  }

  return normalized;
}

function toDictionaryEntry(
  query: string,
  provider: "gemini" | "openai",
  model: string,
  generated: GeneratedVocabContent,
): DictionaryEntry | null {
  if (!generated.isValidVocabulary) {
    return null;
  }

  const answerLemma = clampText(generated.answerLemma, 120);
  const canonicalTerm = clampText(generated.canonicalTerm, 120);
  const normalizedTerm = normalizeTerm(canonicalTerm);
  const normalizedQuery = normalizeTerm(query);
  const definition = clampText(generated.definition, 420);
  const exampleSentence = clampText(generated.exampleSentence, 420);
  const clozeAnswer = clampText(generated.clozeAnswer, 120);
  const clozeSentence = buildClozeFromAnswer(exampleSentence, clozeAnswer);
  const wordFamilyKey = buildWordFamilyKey(answerLemma);
  const senseKey =
    normalizeTerm(clampText(generated.senseKey, 120)).replace(/\s+/g, "-") ||
    "primary";

  if (
    !answerLemma ||
    !canonicalTerm ||
    !normalizedTerm ||
    normalizedTerm !== normalizedQuery ||
    !definition ||
    !exampleSentence ||
    !clozeAnswer ||
    !clozeSentence ||
    !wordFamilyKey
  ) {
    throw new Error(
      `${provider === "gemini" ? "Gemini" : "OpenAI"} returned an internally inconsistent or lemmatized vocabulary card.`,
    );
  }

  const acceptedAnswers = normalizeStringArray(
    [canonicalTerm, ...generated.acceptedAnswers],
    12,
    120,
  );
  const commonCollocations = normalizeStringArray(
    generated.commonCollocations,
    5,
    120,
  ).filter((collocation) =>
    collocation.toLowerCase().includes(canonicalTerm.toLowerCase()),
  );
  const lookupKeys = normalizeStringArray(
    [query, canonicalTerm, answerLemma, ...generated.lookupKeys],
    20,
    120,
  ).map(normalizeTerm);

  return {
    canonicalTerm,
    normalizedTerm,
    partOfSpeech: clampText(generated.partOfSpeech, 80) || "unknown",
    grammaticalRole:
      clampText(generated.grammaticalRole, 120) || "unknown",
    definition,
    definitionLabels: normalizeStringArray(
      generated.definitionLabels,
      8,
      40,
    ),
    usageNote: clampText(generated.usageNote, 280),
    commonCollocations,
    exampleSentence,
    clozeSentence,
    answerLemma,
    clozeAnswer,
    acceptedAnswers,
    wordFamilyKey,
    senseKey,
    pronunciations: [],
    notes: `Generated for learner context with ${provider === "gemini" ? "Gemini" : "OpenAI"}.`,
    lookupKeys,
    contentProvider: provider,
    contentModel: model,
    contentPromptVersion: AI_VOCAB_PROMPT_VERSION,
    contentGeneratedAt: new Date().toISOString(),
  };
}

export async function generateVocabEntry(
  query: string,
  environment: Environment = process.env,
) {
  const generated = await generateVocabContent(query, environment);
  return toDictionaryEntry(
    query,
    generated.provider,
    generated.model,
    generated.content,
  );
}

export function getContentGenerationAttemptVersion(
  entry: Pick<
    DictionaryEntry,
    "contentModel" | "contentPromptVersion" | "contentProvider"
  >,
) {
  if (
    entry.contentProvider !== "gemini" &&
    entry.contentProvider !== "openai"
  ) {
    return entry.contentPromptVersion ?? null;
  }

  return getGenerationAttemptVersion(
    entry.contentProvider,
    entry.contentModel ?? "unknown-model",
    entry.contentPromptVersion ?? AI_VOCAB_PROMPT_VERSION,
  );
}
