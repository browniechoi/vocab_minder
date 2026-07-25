export type PlanTier = "free" | "pro";

export type VocabStatus = "active" | "archived";

export type ReviewRating = "again" | "hard" | "good" | "easy";

export type ReviewCardType = "recognition" | "production" | "listening";

export type ReviewMemoryState = "New" | "Learning" | "Review" | "Relearning";

export type SearchOutcome =
  | "saved"
  | "existing_active"
  | "existing_archived"
  | "limit_reached"
  | "review_load_high"
  | "not_found"
  | "empty_query";

export type Pronunciation = {
  text?: string;
  ipa?: string;
  audioUrl?: string;
  source: "merriam";
};

export type VocabContentProvider = "manual" | "merriam_webster" | "openai";

export type DictionaryEntry = {
  canonicalTerm: string;
  normalizedTerm: string;
  partOfSpeech: string;
  grammaticalRole: string;
  definition: string;
  definitionLabels?: string[];
  usageNote: string;
  commonCollocations: string[];
  exampleSentence: string;
  clozeSentence: string;
  answerLemma: string;
  clozeAnswer: string;
  acceptedAnswers: string[];
  wordFamilyKey: string;
  senseKey: string;
  pronunciations?: Pronunciation[];
  notes?: string;
  lookupKeys: string[];
  contentProvider: VocabContentProvider;
  contentModel?: string;
  contentPromptVersion?: string;
  contentGeneratedAt?: string;
};

export type ReviewState = {
  dueAt: string;
  intervalDays: number;
  easeFactor: number;
  repetitionCount: number;
  lapseCount: number;
  lastReviewedAt: string | null;
  stabilityDays: number;
  difficulty: number;
  fsrsState: ReviewMemoryState;
  learningSteps: number;
  desiredRetention: number;
};

export type VocabItem = {
  id: string;
  originalQuery: string;
  canonicalTerm: string;
  normalizedTerm: string;
  partOfSpeech: string;
  grammaticalRole: string;
  definition: string;
  definitionLabels?: string[];
  usageNote: string;
  commonCollocations: string[];
  exampleSentence: string;
  clozeSentence: string;
  answerLemma: string;
  clozeAnswer: string;
  acceptedAnswers: string[];
  wordFamilyKey: string;
  senseKey: string;
  pronunciations?: Pronunciation[];
  notes?: string;
  contentProvider: VocabContentProvider;
  contentModel?: string;
  contentPromptVersion?: string;
  contentGeneratedAt?: string;
  contentEditedAt?: string;
  status: VocabStatus;
  searchCount: number;
  lastSearchedAt: string;
  createdAt: string;
  reviewState: ReviewState;
};

export type ReviewCard = {
  id: string;
  vocabItemId: string;
  cardType: ReviewCardType;
  isActive: boolean;
  reviewState: ReviewState;
};

export type ReviewQueueItem = VocabItem & {
  reviewCard: ReviewCard;
};

export type ReviewEvent = {
  id: string;
  cardId?: string;
  cardType?: ReviewCardType;
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
  reviewCards: ReviewCard[];
  reviewEvents: ReviewEvent[];
};

export type AppState = {
  planTier: PlanTier;
  activeLimit: number;
  items: VocabItem[];
  reviewCards: ReviewCard[];
  reviewEvents: ReviewEvent[];
};
