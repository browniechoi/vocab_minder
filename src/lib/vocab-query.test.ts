import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeVocabTerm,
  validateVocabQuery,
} from "@/lib/vocab-query";

test("accepts a word or short established phrase", () => {
  assert.deepEqual(validateVocabQuery("  Rule of thumb  "), {
    message: null,
    normalizedQuery: "rule of thumb",
  });
});

test("rejects sentence-like input before lookup", () => {
  const result = validateVocabQuery(
    "Subsidized means having part of the cost paid by an organization",
  );

  assert.equal(result.normalizedQuery, "");
  assert.ok(result.message);
  assert.match(result.message, /short English phrase/u);
});

test("rejects URLs, email addresses, and non-English-symbol input", () => {
  assert.equal(validateVocabQuery("https://example.com").normalizedQuery, "");
  assert.equal(validateVocabQuery("learner@example.com").normalizedQuery, "");
  assert.equal(validateVocabQuery("1234").normalizedQuery, "");
});

test("normalizes case, spacing, punctuation, and diacritics consistently", () => {
  assert.equal(normalizeVocabTerm("  Résumé’s   Detail  "), "resumes detail");
});
