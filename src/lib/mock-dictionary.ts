import type { DictionaryEntry } from "@/lib/app-types";

const ENTRIES: DictionaryEntry[] = [
  {
    canonicalTerm: "meticulous",
    normalizedTerm: "meticulous",
    partOfSpeech: "adjective",
    definition: "Very careful and precise, especially about small details.",
    exampleSentence:
      "She keeps meticulous notes so she can review every word she learns.",
    lookupKeys: ["meticulous", "meticulously"],
  },
  {
    canonicalTerm: "foster",
    normalizedTerm: "foster",
    partOfSpeech: "verb",
    definition: "To encourage the development or growth of something.",
    exampleSentence:
      "Daily flashcards can foster a stronger long-term vocabulary habit.",
    lookupKeys: ["foster", "fosters", "fostering", "fostered"],
  },
  {
    canonicalTerm: "abrupt",
    normalizedTerm: "abrupt",
    partOfSpeech: "adjective",
    definition: "Sudden and unexpected in a way that feels sharp or rude.",
    exampleSentence:
      "His abrupt reply made the conversation feel colder than before.",
    lookupKeys: ["abrupt", "abruptly"],
  },
  {
    canonicalTerm: "convey",
    normalizedTerm: "convey",
    partOfSpeech: "verb",
    definition: "To communicate or make an idea or feeling understood.",
    exampleSentence:
      "A good example sentence can convey the nuance of a difficult word.",
    lookupKeys: ["convey", "conveys", "conveyed", "conveying"],
  },
  {
    canonicalTerm: "resilient",
    normalizedTerm: "resilient",
    partOfSpeech: "adjective",
    definition: "Able to recover quickly after difficulty or pressure.",
    exampleSentence:
      "A resilient learning system helps the user recover from missed days.",
    lookupKeys: ["resilient", "resilience"],
  },
  {
    canonicalTerm: "nuance",
    normalizedTerm: "nuance",
    partOfSpeech: "noun",
    definition: "A subtle difference in meaning, feeling, or expression.",
    exampleSentence:
      "Learners need more than a translation to understand the nuance of a word.",
    lookupKeys: ["nuance", "nuanced", "nuances"],
  },
  {
    canonicalTerm: "infer",
    normalizedTerm: "infer",
    partOfSpeech: "verb",
    definition:
      "To form an opinion or conclusion based on evidence rather than direct statement.",
    exampleSentence:
      "From the example alone, you can infer whether the word sounds formal.",
    lookupKeys: ["infer", "infers", "inferred", "inferring"],
  },
  {
    canonicalTerm: "reconcile",
    normalizedTerm: "reconcile",
    partOfSpeech: "verb",
    definition:
      "To make two ideas, situations, or accounts consistent with each other.",
    exampleSentence:
      "The review log helps reconcile what the learner studied with what is still due.",
    lookupKeys: ["reconcile", "reconciles", "reconciled", "reconciling"],
  },
  {
    canonicalTerm: "tedious",
    normalizedTerm: "tedious",
    partOfSpeech: "adjective",
    definition:
      "Too long, slow, or repetitive, causing boredom or frustration.",
    exampleSentence:
      "Manual saving feels tedious when you search dozens of words a day.",
    lookupKeys: ["tedious", "tediously"],
  },
  {
    canonicalTerm: "squander",
    normalizedTerm: "squander",
    partOfSpeech: "verb",
    definition:
      "To waste something valuable such as time, money, or opportunity in a careless way.",
    exampleSentence:
      "A weak review system can make learners squander time on the wrong words.",
    lookupKeys: ["squander", "squanders", "squandered", "squandering"],
  },
  {
    canonicalTerm: "vibrant",
    normalizedTerm: "vibrant",
    partOfSpeech: "adjective",
    definition: "Full of energy, brightness, or life.",
    exampleSentence:
      "A vibrant example sentence is easier to remember than a flat one.",
    lookupKeys: ["vibrant", "vibrantly"],
  },
];

export function searchDictionary(query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  return (
    ENTRIES.find((entry) => entry.lookupKeys.includes(normalizedQuery)) ?? null
  );
}
