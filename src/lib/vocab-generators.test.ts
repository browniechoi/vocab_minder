import assert from "node:assert/strict";
import test from "node:test";
import { generateVocabEntry } from "@/lib/vocab-enrichment";
import { getVocabGenerationTarget } from "@/lib/vocab-generators";

test("selects the high-throughput Gemini model by default", () => {
  const target = getVocabGenerationTarget({
    GEMINI_API_KEY: "test-key",
    VOCAB_AI_PROVIDER: "gemini",
  });

  assert.deepEqual(target, {
    attemptVersion:
      "gemini:gemini-3.5-flash-lite:2026-07-25-v3",
    model: "gemini-3.5-flash-lite",
    promptVersion: "2026-07-25-v3",
    provider: "gemini",
  });
});

test("keeps OpenAI as an explicit alternative", () => {
  const target = getVocabGenerationTarget({
    OPENAI_API_KEY: "test-key",
    OPENAI_VOCAB_MODEL: "gpt-test",
    VOCAB_AI_PROVIDER: "openai",
  });

  assert.equal(target.provider, "openai");
  assert.equal(target.model, "gpt-test");
  assert.equal(
    target.attemptVersion,
    "openai:gpt-test:2026-07-25-v3",
  );
});

test("rejects a selected provider without its matching key", () => {
  assert.throws(
    () =>
      getVocabGenerationTarget({
        OPENAI_API_KEY: "different-provider-key",
        VOCAB_AI_PROVIDER: "gemini",
      }),
    /GEMINI_API_KEY is not configured/u,
  );
});

test("generates and validates a form-specific Gemini entry", async (context) => {
  const originalFetch = global.fetch;
  context.after(() => {
    global.fetch = originalFetch;
  });

  global.fetch = async (input, init) => {
    assert.match(
      String(input),
      /gemini-3\.5-flash-lite:generateContent$/u,
    );
    assert.equal(
      new Headers(init?.headers).get("x-goog-api-key"),
      "test-key",
    );

    const requestBody = JSON.parse(String(init?.body)) as {
      generationConfig?: {
        responseMimeType?: string;
        thinkingConfig?: { thinkingLevel?: string };
      };
    };
    assert.equal(
      requestBody.generationConfig?.responseMimeType,
      "application/json",
    );
    assert.equal(
      requestBody.generationConfig?.thinkingConfig?.thinkingLevel,
      "medium",
    );

    return Response.json({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  acceptedAnswers: ["subsidized", "subsidised"],
                  answerLemma: "subsidize",
                  canonicalTerm: "subsidized",
                  clozeAnswer: "subsidized",
                  commonCollocations: ["subsidized housing"],
                  definition:
                    "supported financially so the cost to the user is lower",
                  definitionLabels: [],
                  exampleSentence:
                    "The city offers subsidized housing to qualifying residents.",
                  grammaticalRole: "adjective",
                  isValidVocabulary: true,
                  lookupKeys: ["subsidized", "subsidize"],
                  partOfSpeech: "adjective",
                  senseKey: "adjective-financial-support",
                  usageNote:
                    "Commonly describes housing, education, or healthcare.",
                }),
              },
            ],
          },
        },
      ],
    });
  };

  const entry = await generateVocabEntry("subsidized", {
    GEMINI_API_KEY: "test-key",
    VOCAB_AI_PROVIDER: "gemini",
  });

  assert.equal(entry?.canonicalTerm, "subsidized");
  assert.equal(entry?.answerLemma, "subsidize");
  assert.equal(entry?.clozeAnswer, "subsidized");
  assert.equal(
    entry?.clozeSentence,
    "The city offers _____ housing to qualifying residents.",
  );
  assert.equal(entry?.contentProvider, "gemini");
  assert.equal(entry?.contentModel, "gemini-3.5-flash-lite");
});
