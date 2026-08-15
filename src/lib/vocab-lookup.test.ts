import assert from "node:assert/strict";
import test from "node:test";
import { lookupVocab } from "@/lib/vocab-lookup";

test("force exact accepts valid AI content over spelling suggestions", async (context) => {
  const originalFetch = global.fetch;
  const originalGeminiKey = process.env.GEMINI_API_KEY;
  const originalMerriamKey = process.env.MERRIAM_API_KEY;
  const originalProvider = process.env.VOCAB_AI_PROVIDER;

  context.after(() => {
    global.fetch = originalFetch;
    if (originalGeminiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalGeminiKey;
    }
    if (originalMerriamKey === undefined) {
      delete process.env.MERRIAM_API_KEY;
    } else {
      process.env.MERRIAM_API_KEY = originalMerriamKey;
    }
    if (originalProvider === undefined) {
      delete process.env.VOCAB_AI_PROVIDER;
    } else {
      process.env.VOCAB_AI_PROVIDER = originalProvider;
    }
  });

  process.env.GEMINI_API_KEY = "gemini-test-key";
  process.env.MERRIAM_API_KEY = "merriam-test-key";
  process.env.VOCAB_AI_PROVIDER = "gemini";
  global.fetch = async (input) => {
    if (String(input).includes("dictionaryapi.com")) {
      return Response.json(["conflict", "conflicted"]);
    }

    return Response.json({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  acceptedAnswers: ["conflate"],
                  answerLemma: "conflate",
                  canonicalTerm: "conflate",
                  clozeAnswer: "conflate",
                  commonCollocations: ["conflate two issues"],
                  definition: "to wrongly treat two distinct things as the same",
                  definitionLabels: [],
                  exampleSentence:
                    "People often conflate popularity with credibility.",
                  grammaticalRole: "base-form verb",
                  isValidVocabulary: true,
                  lookupKeys: ["conflate"],
                  partOfSpeech: "verb",
                  senseKey: "verb-combine-distinct-things",
                  usageNote: "Common when discussing ideas or categories.",
                }),
              },
            ],
          },
        },
      ],
    });
  };

  const normal = await lookupVocab("conflate");
  assert.equal(normal.entry, null);
  assert.deepEqual(normal.suggestions, ["conflict", "conflicted"]);

  const forced = await lookupVocab("conflate", true);
  assert.equal(forced.entry?.canonicalTerm, "conflate");
  assert.deepEqual(forced.suggestions, []);
});
