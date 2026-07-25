import type { VocabContentProvider } from "@/lib/app-types";

export type AiVocabProvider = Extract<
  VocabContentProvider,
  "gemini" | "openai"
>;

export type GeneratedVocabContent = {
  acceptedAnswers: string[];
  answerLemma: string;
  canonicalTerm: string;
  clozeAnswer: string;
  commonCollocations: string[];
  definition: string;
  definitionLabels: string[];
  exampleSentence: string;
  grammaticalRole: string;
  isValidVocabulary: boolean;
  lookupKeys: string[];
  partOfSpeech: string;
  senseKey: string;
  usageNote: string;
};

export type VocabGenerationResult = {
  content: GeneratedVocabContent;
  model: string;
  provider: AiVocabProvider;
};

export const AI_VOCAB_PROMPT_VERSION = "2026-07-25-v3";

export const GENERATED_VOCAB_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    isValidVocabulary: {
      type: "boolean",
      description:
        "False when the query is not a real English word or established phrase.",
    },
    canonicalTerm: {
      type: "string",
      description:
        "The exact word form or phrase being learned. Preserve a valid inflected query instead of lemmatizing it.",
    },
    answerLemma: {
      type: "string",
      description:
        "The dictionary lemma used only to group related forms into a word family.",
    },
    partOfSpeech: {
      type: "string",
      description: "The part of speech for the generated sense.",
    },
    grammaticalRole: {
      type: "string",
      description:
        "The specific role of this form, such as adjective, past-tense verb, past participle, plural noun, or base-form verb.",
    },
    definition: {
      type: "string",
      description:
        "A learner-friendly explanation of what this exact queried form means in its selected real-world use.",
    },
    definitionLabels: {
      type: "array",
      items: { type: "string" },
      description:
        "Register or domain labels such as formal, literary, medical, or informal.",
    },
    usageNote: {
      type: "string",
      description:
        "One concise note explaining where or how this exact form is commonly used.",
    },
    commonCollocations: {
      type: "array",
      items: { type: "string" },
      description:
        "Two to five common real-world combinations containing this exact form.",
    },
    exampleSentence: {
      type: "string",
      description:
        "One realistic sentence containing the exact clozeAnswer once.",
    },
    clozeAnswer: {
      type: "string",
      description:
        "The exact grammatical surface form used in exampleSentence.",
    },
    acceptedAnswers: {
      type: "array",
      items: { type: "string" },
      description:
        "Valid spelling variants of canonicalTerm. Do not include other grammatical forms.",
    },
    senseKey: {
      type: "string",
      description:
        "A short lowercase kebab-case identifier for the selected grammatical role and meaning.",
    },
    lookupKeys: {
      type: "array",
      items: { type: "string" },
      description: "Useful canonical spelling variants for future lookup.",
    },
  },
  required: [
    "isValidVocabulary",
    "canonicalTerm",
    "answerLemma",
    "partOfSpeech",
    "grammaticalRole",
    "definition",
    "definitionLabels",
    "usageNote",
    "commonCollocations",
    "exampleSentence",
    "clozeAnswer",
    "acceptedAnswers",
    "senseKey",
    "lookupKeys",
  ],
} as const;

export const VOCAB_SYSTEM_PROMPT = [
  "Create one high-quality English vocabulary learning record for an adult learner.",
  "Treat the exact query as the learning target and choose its most common life-applicable general-English use.",
  "canonicalTerm must preserve the query's grammatical form. Never replace a valid inflected form with its lemma.",
  "For example, canonicalTerm for 'subsidized' must be 'subsidized', while answerLemma is 'subsidize'.",
  "Use grammaticalRole to distinguish uses such as an adjective from a past-tense verb.",
  "answerLemma is family metadata only and is not the expected reverse-recall answer.",
  "Keep register and domain labels separate from the definition.",
  "The definition must explain the exact canonicalTerm's selected use clearly and practically without containing canonicalTerm.",
  "Prefer an example where clozeAnswer exactly matches canonicalTerm when natural.",
  "Write one concrete, realistic example sentence that makes the intended meaning obvious from context.",
  "The example must contain clozeAnswer exactly once. clozeAnswer must be the exact grammatical surface form used in that sentence.",
  "acceptedAnswers may contain spelling variants of canonicalTerm, but never other tense, plural, comparative, or inflected forms.",
  "commonCollocations must be natural, frequent-looking combinations that include canonicalTerm exactly.",
  "If the query is not a real English word or established phrase, set isValidVocabulary to false and return empty values for the remaining fields.",
].join(" ");

export function getGenerationAttemptVersion(
  provider: AiVocabProvider,
  model: string,
  promptVersion = AI_VOCAB_PROMPT_VERSION,
) {
  return `${provider}:${model}:${promptVersion}`;
}
