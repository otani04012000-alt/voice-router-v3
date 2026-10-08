export type SpeechSegment = { text: string; rate: number; pauseAfter: number };

export function planSpeech(text: string, slow = false): SpeechSegment[] {
  // Keep punctuation for the device voice's question/statement intonation.
  // Split only at sentence boundaries; commas and words stay together.
  const sentences = text.match(/[^。！？!?\n]+[。！？!?]+[」』”’"）)]*|[^。！？!?\n]+|[。！？!?]+/gu) ?? [];
  return sentences.map((sentence, index) => {
    const value = sentence.trim();
    const length = Array.from(value).length;
    return {
      text: value,
      rate: slow ? 0.7 : length <= 14 ? 1 : length >= 60 ? 0.9 : 0.95,
      pauseAfter: index === sentences.length - 1 ? 0 : slow ? 240 : 140,
    };
  }).filter((segment) => segment.text.length > 0);
}

export function playSpeechSequence(
  segments: SpeechSegment[],
  play: (segment: SpeechSegment, ended: () => void, failed: () => void) => void,
  finished: () => void,
  schedule: (callback: () => void, delay: number) => () => void = (callback, delay) => {
    const timer = setTimeout(callback, delay);
    return () => clearTimeout(timer);
  },
) {
  let active = true;
  let cancelPause: (() => void) | undefined;
  const next = (index: number) => {
    if (!active) return;
    if (index >= segments.length) {
      active = false;
      finished();
      return;
    }
    let settled = false;
    play(segments[index], () => {
      if (!active || settled) return;
      settled = true;
      if (index === segments.length - 1) next(index + 1);
      else cancelPause = schedule(() => next(index + 1), segments[index].pauseAfter);
    }, () => {
      if (!active || settled) return;
      active = false;
      settled = true;
      cancelPause?.();
    });
  };
  next(0);
  return () => {
    active = false;
    cancelPause?.();
  };
}
