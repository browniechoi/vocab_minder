import type { DictionaryEntry } from "@/lib/app-types";

type VocabEnrichment = {
  clozeSentence: string;
  definition: string;
  exampleSentence: string;
};

const VOCAB_ENRICHMENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    definition: {
      type: "string",
      description:
        "One learner-friendly sentence that explains meaning and practical usage.",
    },
    exampleSentence: {
      type: "string",
      description:
        "One realistic sentence showing the word in a concrete situation.",
    },
    clozeSentence: {
      type: "string",
      description:
        "The same usage idea as a fill-in-the-blank sentence using exactly one _____.",
    },
  },
  required: ["definition", "exampleSentence", "clozeSentence"],
};

function clampText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function buildClozeSentence(entry: DictionaryEntry) {
  if (entry.clozeSentence?.includes("_____")) {
    return entry.clozeSentence;
  }

  const escapedTerm = entry.canonicalTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const termPattern = new RegExp(`\\b${escapedTerm}(?:ed|ing|s)?\\b`, "i");
  if (termPattern.test(entry.exampleSentence)) {
    return entry.exampleSentence.replace(termPattern, "_____");
  }

  return `A sentence using "${entry.canonicalTerm}" belongs here: _____.`;
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

function applySafeEnrichment(
  entry: DictionaryEntry,
  enrichment: Partial<VocabEnrichment>,
): DictionaryEntry {
  const definition = clampText(enrichment.definition, 320);
  const exampleSentence = clampText(enrichment.exampleSentence, 320);
  const clozeSentence = clampText(enrichment.clozeSentence, 320);

  return {
    ...entry,
    definition: definition || entry.definition,
    exampleSentence: exampleSentence || entry.exampleSentence,
    clozeSentence:
      clozeSentence && clozeSentence.includes("_____")
        ? clozeSentence
        : buildClozeSentence({
            ...entry,
            exampleSentence: exampleSentence || entry.exampleSentence,
          }),
    notes: entry.notes
      ? `${entry.notes} AI-enriched for learner context when configured.`
      : "AI-enriched for learner context when configured.",
  };
}

export async function enrichDictionaryEntry(entry: DictionaryEntry) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ...entry,
      clozeSentence: buildClozeSentence(entry),
    };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VOCAB_MODEL ?? "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content:
              "You improve English vocabulary flashcards. Return JSON only. Stay faithful to the dictionary meaning. Do not invent specialized meanings. Keep examples realistic, concrete, and useful for adult English learners.",
          },
          {
            role: "user",
            content: JSON.stringify({
              word: entry.canonicalTerm,
              partOfSpeech: entry.partOfSpeech,
              dictionaryDefinition: entry.definition,
              dictionaryExample: entry.exampleSentence,
              labels: entry.definitionLabels ?? [],
            }),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "vocab_card_enrichment",
            schema: VOCAB_ENRICHMENT_SCHEMA,
            strict: true,
          },
        },
      }),
    });

    if (!response.ok) {
      return {
        ...entry,
        clozeSentence: buildClozeSentence(entry),
      };
    }

    const outputText = extractOutputText((await response.json()) as unknown);
    const parsed = JSON.parse(outputText) as Partial<VocabEnrichment>;
    return applySafeEnrichment(entry, parsed);
  } catch {
    return {
      ...entry,
      clozeSentence: buildClozeSentence(entry),
    };
  }
}
