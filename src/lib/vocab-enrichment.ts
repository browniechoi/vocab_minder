import type { DictionaryEntry } from "@/lib/app-types";
import { buildClozeFromAnswer } from "@/lib/cloze";

type GeneratedVocabContent = {
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

export const OPENAI_VOCAB_PROMPT_VERSION = "2026-07-25-v2";

const GENERATED_VOCAB_SCHEMA = {
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

function extractOutputText(payload: unknown) {
  if (typeof payload !== "object" || payload === null) {
    return "";
  }

  const response = payload as {
    output?: Array<{
      content?: Array<{
        text?: string;
        type?: string;
      }>;
    }>;
    output_text?: string;
  };

  if (typeof response.output_text === "string") {
    return response.output_text;
  }

  return (
    response.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .find((text): text is string => typeof text === "string") ?? ""
  );
}

function toDictionaryEntry(
  query: string,
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
      "OpenAI returned an internally inconsistent or lemmatized vocabulary card.",
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
    notes: "Generated for learner context with OpenAI.",
    lookupKeys,
    contentProvider: "openai",
    contentModel: model,
    contentPromptVersion: OPENAI_VOCAB_PROMPT_VERSION,
    contentGeneratedAt: new Date().toISOString(),
  };
}

export async function generateVocabEntry(query: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const model = process.env.OPENAI_VOCAB_MODEL ?? "gpt-4.1-mini";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: [
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
            ].join(" "),
          },
          {
            role: "user",
            content: JSON.stringify({ query }),
          },
        ],
        max_output_tokens: 1200,
        text: {
          format: {
            type: "json_schema",
            name: "vocab_learning_record",
            schema: GENERATED_VOCAB_SCHEMA,
            strict: true,
          },
        },
      }),
    });

    if (!response.ok) {
      const requestId = response.headers.get("x-request-id");
      throw new Error(
        `OpenAI vocabulary generation failed with status ${response.status}${
          requestId ? ` (${requestId})` : ""
        }.`,
      );
    }

    const outputText = extractOutputText((await response.json()) as unknown);
    if (!outputText) {
      throw new Error("OpenAI vocabulary generation returned no output.");
    }

    const generated = JSON.parse(outputText) as GeneratedVocabContent;
    return toDictionaryEntry(query, model, generated);
  } finally {
    clearTimeout(timeout);
  }
}
