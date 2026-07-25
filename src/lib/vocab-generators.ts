import {
  AI_VOCAB_PROMPT_VERSION,
  type AiVocabProvider,
  GENERATED_VOCAB_SCHEMA,
  getGenerationAttemptVersion,
  type GeneratedVocabContent,
  type VocabGenerationResult,
  VOCAB_SYSTEM_PROMPT,
} from "@/lib/vocab-generation-contract";

export type Environment = Record<string, string | undefined>;

export type VocabGenerationTarget = {
  attemptVersion: string;
  model: string;
  promptVersion: string;
  provider: AiVocabProvider;
};

function extractOpenAiOutputText(payload: unknown) {
  if (typeof payload !== "object" || payload === null) {
    return "";
  }

  const response = payload as {
    output?: Array<{
      content?: Array<{
        text?: string;
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

function extractGeminiOutputText(payload: unknown) {
  if (typeof payload !== "object" || payload === null) {
    return "";
  }

  const response = payload as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
        }>;
      };
    }>;
  };

  return (
    response.candidates
      ?.flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text)
      .find((text): text is string => typeof text === "string") ?? ""
  );
}

function normalizeProvider(value: string | undefined): AiVocabProvider | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized === "gemini" || normalized === "openai") {
    return normalized;
  }

  throw new Error(
    `Unsupported VOCAB_AI_PROVIDER "${value}". Use "gemini" or "openai".`,
  );
}

export function getVocabGenerationTarget(
  environment: Environment = process.env,
): VocabGenerationTarget {
  const configuredProvider = normalizeProvider(
    environment.VOCAB_AI_PROVIDER,
  );
  const provider =
    configuredProvider ??
    (environment.GEMINI_API_KEY
      ? "gemini"
      : environment.OPENAI_API_KEY
        ? "openai"
        : null);

  if (!provider) {
    throw new Error(
      "No AI vocabulary provider is configured. Set VOCAB_AI_PROVIDER and its server-side API key.",
    );
  }

  const apiKey =
    provider === "gemini"
      ? environment.GEMINI_API_KEY
      : environment.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      `${provider === "gemini" ? "GEMINI_API_KEY" : "OPENAI_API_KEY"} is not configured for VOCAB_AI_PROVIDER=${provider}.`,
    );
  }

  const model =
    provider === "gemini"
      ? environment.GEMINI_VOCAB_MODEL ?? "gemini-3.5-flash-lite"
      : environment.OPENAI_VOCAB_MODEL ?? "gpt-4.1-mini";
  if (!/^[a-z0-9._/-]+$/iu.test(model)) {
    throw new Error(`Invalid model identifier "${model}".`);
  }

  return {
    attemptVersion: getGenerationAttemptVersion(provider, model),
    model,
    promptVersion: AI_VOCAB_PROMPT_VERSION,
    provider,
  };
}

export function isVocabGenerationConfigured(
  environment: Environment = process.env,
) {
  try {
    getVocabGenerationTarget(environment);
    return true;
  } catch {
    return false;
  }
}

async function generateWithGemini(
  query: string,
  target: VocabGenerationTarget,
  apiKey: string,
  signal: AbortSignal,
) {
  const model = target.model.replace(/^models\//u, "");
  const thinkingConfig = model.startsWith("gemini-2.5")
    ? { thinkingBudget: 512 }
    : {
        thinkingLevel: model.includes("flash-lite") ? "medium" : "low",
      };
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      signal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: VOCAB_SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: JSON.stringify({ query }) }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 1800,
          responseJsonSchema: GENERATED_VOCAB_SCHEMA,
          responseMimeType: "application/json",
          thinkingConfig,
        },
      }),
    },
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    const detail = payload?.error?.message?.slice(0, 300);
    throw new Error(
      `Gemini vocabulary generation failed with status ${response.status}${
        detail ? `: ${detail}` : ""
      }.`,
    );
  }

  const outputText = extractGeminiOutputText(
    (await response.json()) as unknown,
  );
  if (!outputText) {
    throw new Error("Gemini vocabulary generation returned no output.");
  }

  return JSON.parse(outputText) as GeneratedVocabContent;
}

async function generateWithOpenAi(
  query: string,
  target: VocabGenerationTarget,
  apiKey: string,
  signal: AbortSignal,
) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    signal,
    body: JSON.stringify({
      model: target.model,
      input: [
        {
          role: "system",
          content: VOCAB_SYSTEM_PROMPT,
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

  const outputText = extractOpenAiOutputText(
    (await response.json()) as unknown,
  );
  if (!outputText) {
    throw new Error("OpenAI vocabulary generation returned no output.");
  }

  return JSON.parse(outputText) as GeneratedVocabContent;
}

export async function generateVocabContent(
  query: string,
  environment: Environment = process.env,
): Promise<VocabGenerationResult> {
  const target = getVocabGenerationTarget(environment);
  const apiKey =
    target.provider === "gemini"
      ? environment.GEMINI_API_KEY
      : environment.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(`Missing API key for ${target.provider}.`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const content =
      target.provider === "gemini"
        ? await generateWithGemini(
            query,
            target,
            apiKey,
            controller.signal,
          )
        : await generateWithOpenAi(
            query,
            target,
            apiKey,
            controller.signal,
          );

    return {
      content,
      model: target.model,
      provider: target.provider,
    };
  } finally {
    clearTimeout(timeout);
  }
}
