export const LANGUAGES = {
  ja: { label: "日本語", native: "日本語", locale: "ja-JP", short: "日" },
  vi: {
    label: "ベトナム語",
    native: "Tiếng Việt",
    locale: "vi-VN",
    short: "越",
  },
  km: {
    label: "クメール語",
    native: "ភាសាខ្មែរ",
    locale: "km-KH",
    short: "柬",
  },
  en: { label: "英語", native: "English", locale: "en-US", short: "英" },
} as const;
export type Language = keyof typeof LANGUAGES;
export const TONES = {
  natural: "自然に",
  polite: "丁寧に",
  warm: "親しみを込めて",
} as const;
export type Tone = keyof typeof TONES;
export const MAX_TEXT = 600;
export type Translation = {
  original: string;
  translated: string;
  source: Language;
  target: Language;
  provider: "openrouter" | "mymemory" | "identity";
  toneApplied: boolean;
};
export type Turn = Translation & {
  id: string;
  createdAt: number;
  speaker: "you" | "partner";
  backTranslation?: string;
};
export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && Object.hasOwn(LANGUAGES, value);
}
// MyMemory limits UTF-8 bytes, not string length. Never split code points.
export function splitUtf8(text: string, limit = 480): string[] {
  const encoder = new TextEncoder(),
    chunks: string[] = [];
  let chunk = "",
    bytes = 0;
  for (const character of text) {
    const size = encoder.encode(character).length;
    if (bytes + size > limit) {
      chunks.push(chunk);
      chunk = "";
      bytes = 0;
    }
    chunk += character;
    bytes += size;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}
export function isTranslation(value: unknown): value is Translation {
  if (!value || typeof value !== "object") return false;
  const t = value as Translation;
  return (
    isLanguage(t.source) &&
    isLanguage(t.target) &&
    typeof t.original === "string" &&
    t.original.length <= MAX_TEXT &&
    typeof t.translated === "string" &&
    t.translated.length > 0 &&
    t.translated.length <= 5000 &&
    ["openrouter", "mymemory", "identity"].includes(t.provider) &&
    typeof t.toneApplied === "boolean"
  );
}
export async function requestTranslation(
  text: string,
  source: Language,
  target: Language,
  tone: Tone,
  signal?: AbortSignal,
): Promise<Translation> {
  const response = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, source, target, tone }),
    signal,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      data?.error || "翻訳に接続できませんでした。もう一度お試しください。",
    );
  if (!isTranslation(data))
    throw new Error("翻訳結果を読み取れませんでした。もう一度お試しください。");
  return data;
}
