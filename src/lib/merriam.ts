import type { DictionaryEntry, Pronunciation } from "@/lib/app-types";

type MerriamVis = {
  t?: string;
};

type MerriamDtItem = [string, unknown];

type MerriamSense = {
  dt?: MerriamDtItem[];
};

type MerriamSenseGroup = [string, MerriamSense];

type MerriamDefinition = {
  sseq?: MerriamSenseGroup[][];
};

type MerriamAppShortDef = {
  hw?: string;
  fl?: string;
  def?: string[];
};

type MerriamPronunciation = {
  mw?: string;
  ipa?: string;
  sound?: {
    audio?: string;
  };
};

type MerriamEntry = {
  meta?: {
    id?: string;
    stems?: string[];
    ["app-shortdef"]?: MerriamAppShortDef;
  };
  hwi?: {
    hw?: string;
    prs?: MerriamPronunciation[];
  };
  fl?: string;
  def?: MerriamDefinition[];
  shortdef?: string[];
};

function cleanMerriamText(value: string) {
  return value
    .replace(/\{bc\}/g, "")
    .replace(/\{ldquo\}|\{rdquo\}/g, '"')
    .replace(/\{it\}|\{\/it\}|\{wi\}|\{\/wi\}|\{phrase\}|\{\/phrase\}/g, "")
    .replace(/\{dx\}|\{\/dx\}|\{sx\}|\{\/sx\}|\{sc\}|\{\/sc\}/g, "")
    .replace(/\{parahw\}|\{\/parahw\}|\{ahw\}|\{\/ahw\}/g, "")
    .replace(/\{dxt\|([^|}]+)\|[^}]*\}/g, "$1")
    .replace(/\{[^}]+\}/g, "")
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanPronunciationText(value: string) {
  return value.replace(/\{[^}]+\}/g, "").replace(/\s+/g, " ").trim();
}

function getMerriamAudioUrl(audio: string) {
  const normalizedAudio = audio.trim();
  if (!normalizedAudio) {
    return undefined;
  }

  const subdirectory = normalizedAudio.startsWith("bix")
    ? "bix"
    : normalizedAudio.startsWith("gg")
      ? "gg"
      : /^[^a-z]/i.test(normalizedAudio)
        ? "number"
        : normalizedAudio[0].toLowerCase();

  return `https://media.merriam-webster.com/audio/prons/en/us/mp3/${subdirectory}/${normalizedAudio}.mp3`;
}

function extractExample(entry: MerriamEntry) {
  for (const definition of entry.def ?? []) {
    for (const senseList of definition.sseq ?? []) {
      for (const [, sense] of senseList) {
        for (const [kind, value] of sense.dt ?? []) {
          if (kind !== "vis" || !Array.isArray(value)) {
            continue;
          }

          const firstExample = value.find(
            (item): item is MerriamVis =>
              typeof item === "object" &&
              item !== null &&
              "t" in item &&
              typeof item.t === "string",
          );

          if (firstExample?.t) {
            return cleanMerriamText(firstExample.t);
          }
        }
      }
    }
  }

  return "";
}

function extractPronunciations(entry: MerriamEntry): Pronunciation[] {
  const seen = new Set<string>();
  const pronunciations: Pronunciation[] = [];

  for (const pronunciation of entry.hwi?.prs ?? []) {
    const text = pronunciation.mw
      ? cleanPronunciationText(pronunciation.mw)
      : undefined;
    const ipa = pronunciation.ipa
      ? cleanPronunciationText(pronunciation.ipa)
      : undefined;
    const audioUrl = pronunciation.sound?.audio
      ? getMerriamAudioUrl(pronunciation.sound.audio)
      : undefined;

    if (!text && !ipa && !audioUrl) {
      continue;
    }

    const key = `${text ?? ""}|${ipa ?? ""}|${audioUrl ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    pronunciations.push({
      text,
      ipa,
      audioUrl,
      source: "merriam",
    });
  }

  return pronunciations;
}

function isMerriamEntry(value: unknown): value is MerriamEntry {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toDictionaryEntry(payload: unknown): DictionaryEntry | null {
  if (!Array.isArray(payload) || payload.length === 0) {
    return null;
  }

  const firstEntry = payload.find(isMerriamEntry);
  if (!firstEntry) {
    return null;
  }

  const appShortDef = firstEntry.meta?.["app-shortdef"];
  const canonicalTerm = cleanMerriamText(
    appShortDef?.hw ??
      firstEntry.hwi?.hw ??
      firstEntry.meta?.id?.split(":")[0] ??
      "",
  );
  const definition = cleanMerriamText(
    appShortDef?.def?.[0] ?? firstEntry.shortdef?.[0] ?? "",
  );

  if (!canonicalTerm || !definition) {
    return null;
  }

  return {
    canonicalTerm,
    normalizedTerm: canonicalTerm.toLowerCase(),
    partOfSpeech: appShortDef?.fl ?? firstEntry.fl ?? "unknown",
    definition,
    exampleSentence:
      extractExample(firstEntry) || "No example sentence available in this entry.",
    pronunciations: extractPronunciations(firstEntry),
    notes: "Imported from Merriam-Webster Learner's Dictionary.",
    lookupKeys: firstEntry.meta?.stems?.map((stem) => stem.toLowerCase()) ?? [],
  };
}

export async function lookupMerriamEntry(query: string, apiKey: string) {
  const endpoint = new URL(
    `https://www.dictionaryapi.com/api/v3/references/learners/json/${encodeURIComponent(query)}`,
  );
  endpoint.searchParams.set("key", apiKey);

  const response = await fetch(endpoint, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Merriam lookup failed with status ${response.status}.`);
  }

  return toDictionaryEntry((await response.json()) as unknown);
}
