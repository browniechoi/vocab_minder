export type PlanTier = "free" | "pro";

export type VocabStatus = "active" | "archived";

export type ReviewRating = "again" | "hard" | "good" | "easy";

export type SearchOutcome =
  | "saved"
  | "existing_active"
  | "existing_archived"
  | "limit_reached"
  | "not_found"
  | "empty_query";

export type Pronunciation = {
  text?: string;
  ipa?: string;
  audioUrl?: string;
  source: "merriam";
};

export type DictionaryEntry = {
  canonicalTerm: string;
  normalizedTerm: string;
  partOfSpeech: string;
  definition: string;
  definitionLabels?: string[];
  exampleSentence: string;
  pronunciations?: Pronunciation[];
  notes?: string;
  lookupKeys: string[];
};

export type ReviewState = {
  dueAt: string;
  intervalDays: number;
  easeFactor: number;
  repetitionCount: number;
  lapseCount: number;
  lastReviewedAt: string | null;
};

export type VocabItem = {
  id: string;
  originalQuery: string;
  canonicalTerm: string;
  normalizedTerm: string;
  partOfSpeech: string;
  definition: string;
  definitionLabels?: string[];
  exampleSentence: string;
  pronunciations?: Pronunciation[];
  notes?: string;
  status: VocabStatus;
  searchCount: number;
  lastSearchedAt: string;
  createdAt: string;
  reviewState: ReviewState;
};

export type ReviewEvent = {
  id: string;
  vocabItemId: string;
  rating: ReviewRating;
  reviewedAt: string;
  previousDueAt: string;
  newDueAt: string;
};

export type PersistedVocabItem = Omit<VocabItem, "reviewState">;

export type ProfileState = {
  planTier: PlanTier;
  activeLimit: number;
};

export type ReviewCache = {
  reviewStates: Record<string, ReviewState>;
  reviewEvents: ReviewEvent[];
};

export type AppState = {
  planTier: PlanTier;
  activeLimit: number;
  items: VocabItem[];
  reviewEvents: ReviewEvent[];
};
