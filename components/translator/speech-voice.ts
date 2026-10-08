export function normalizeSpeechLanguage(value: string) {
  return value.replaceAll("_", "-").toLowerCase();
}

export function selectSpeechVoice<T extends { lang: string }>(
  voices: T[],
  locale: string,
) {
  const normalizedLocale = normalizeSpeechLanguage(locale);
  const baseLanguage = normalizedLocale.split("-")[0];

  return (
    voices.find(
      (voice) => normalizeSpeechLanguage(voice.lang) === normalizedLocale,
    ) ??
    voices.find(
      (voice) =>
        normalizeSpeechLanguage(voice.lang).split("-")[0] === baseLanguage,
    )
  );
}
