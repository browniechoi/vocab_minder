import assert from "node:assert/strict";
import test from "node:test";
import { getMerriamSuggestions } from "@/lib/merriam";

test("keeps spelling suggestions separate from dictionary entries", () => {
  assert.deepEqual(
    getMerriamSuggestions([
      "squander",
      "squanderer",
      "squander",
      { meta: { id: "ignored-entry" } },
    ]),
    ["squander", "squanderer"],
  );
});

test("limits and sanitizes suggestion payloads", () => {
  assert.deepEqual(
    getMerriamSuggestions([
      " Alpha ",
      "beta",
      "gamma",
      "delta",
      "epsilon",
      "zeta",
      123,
    ]),
    ["alpha", "beta", "gamma", "delta", "epsilon"],
  );
});
