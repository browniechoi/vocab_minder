import type { DictionaryEntry } from "@/lib/app-types";
import { buildClozeFromAnswer } from "@/lib/cloze";

type GeneratedVocabContent = {
  acceptedAnswers: string[];
  answerLemma: string;
  canonicalTerm: string;
  clozeAnswer: string;
  definition: string;
  definitionLabels: string[];
  exampleSentence: string;
  isValidVocabulary: boolean;
  lookupKeys: string[];
  partOfSpeech: string;
};

export const OPENAI_VOCAB_PROMPT_VERSION = "2026-07-25-v1";

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
      description: "The canonical dictionary headword or established phrase.",
    },
    answerLemma: {
      type: "string",
      description:
        "The canonical lemma expected for meaning-to-word reverse recall.",
    },
    partOfSpeech: {
      type: "string",
      description: "The part of speech for the generated sense.",
    },
    definition: {
      type: "string",
      description:
        "A learner-friendly explanation of meaning and practical usage.",
    },
    definitionLabels: {
      type: "array",
      items: { type: "string" },
      description:
        "Register or domain labels such as formal, literary, medical, or informal.",
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
        "Valid spelling variants of answerLemma, excluding inflected forms.",
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
    "definition",
    "definitionLabels",
    "exampleSentence",
    "clozeAnswer",
    "acceptedAnswers",
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
  const generatedCanonicalTerm = clampText(generated.canonicalTerm, 120);
  const canonicalTerm =
    generatedCanonicalTerm &&
    normalizeTerm(generatedCanonicalTerm) === normalizeTerm(answerLemma)
      ? generatedCanonicalTerm
      : answerLemma;
  const normalizedTerm = normalizeTerm(answerLemma || canonicalTerm);
  const definition = clampText(generated.definition, 420);
  const exampleSentence = clampText(generated.exampleSentence, 420);
  const clozeAnswer = clampText(generated.clozeAnswer, 120);
  const clozeSentence = buildClozeFromAnswer(exampleSentence, clozeAnswer);

  if (
    !answerLemma ||
    !canonicalTerm ||
    !normalizedTerm ||
    !definition ||
    !exampleSentence ||
    !clozeAnswer ||
    !clozeSentence
  ) {
    throw new Error("OpenAI returned an internally inconsistent vocabulary card.");
  }

  const acceptedAnswers = normalizeStringArray(
    [answerLemma, canonicalTerm, ...generated.acceptedAnswers],
    12,
    120,
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
    definition,
    definitionLabels: normalizeStringArray(
      generated.definitionLabels,
      8,
      40,
    ),
    exampleSentence,
    clozeSentence,
    answerLemma,
    clozeAnswer,
    acceptedAnswers,
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
              "Use the most common general-English sense that matches the query.",
              "If the query is inflected, answerLemma and canonicalTerm must use the dictionary lemma.",
              "Keep register and domain labels separate from the definition.",
              "The definition must be clear, practical, and must not contain the answerLemma.",
              "Write one concrete, realistic example sentence that makes the intended meaning obvious from context.",
              "The example must contain clozeAnswer exactly once. clozeAnswer must be the exact grammatical surface form used in that sentence.",
              "acceptedAnswers may contain spelling variants of answerLemma, but never tense, plural, comparative, or other inflected forms.",
              "If the query is not a real English word or established phrase, set isValidVocabulary to false and return empty values for the remaining fields.",
            ].join(" "),
          },
          {
            role: "user",
            content: JSON.stringify({ query }),
          },
        ],
        max_output_tokens: 900,
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
