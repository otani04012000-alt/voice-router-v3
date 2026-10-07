"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { microphoneTransition, type MicrophonePhase } from "./microphone-state";
import { LANGUAGES, type Language } from "@/lib/translation";

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((e: {
        resultIndex: number;
        results: {
          length: number;
          [i: number]: {
            isFinal: boolean;
            [i: number]: { transcript: string };
          };
        };
      }) => void)
    | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  onaudiostart: (() => void) | null;
  onaudioend: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechWindow = {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

export type VoiceSignal = {
  low: number;
  mid: number;
  high: number;
  level: number;
  peak: number;
  updatedAt: number;
};

export function useVoice(
  onText: (text: string) => void,
  onNotice: (text: string) => void,
) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [micPhase, setMicPhase] = useState<MicrophonePhase>("off");
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const signal = useRef<VoiceSignal>({
    low: 0,
    mid: 0,
    high: 0,
    level: 0,
    peak: 0,
    updatedAt: 0,
  });
  const meterFrame = useRef<number | null>(null);
  const meterStream = useRef<MediaStream | null>(null);
  const meterContext = useRef<AudioContext | null>(null);
  const textCallback = useRef(onText),
    noticeCallback = useRef(onNotice);

  const stopMeter = useCallback(() => {
    if (meterFrame.current !== null) cancelAnimationFrame(meterFrame.current);
    meterFrame.current = null;
    meterStream.current?.getTracks().forEach((track) => track.stop());
    meterStream.current = null;
    const context = meterContext.current;
    meterContext.current = null;
    if (context && context.state !== "closed") void context.close();
    signal.current = {
      low: 0,
      mid: 0,
      high: 0,
      level: 0,
      peak: 0,
      updatedAt: Date.now(),
    };
  }, []);

  const startMeter = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || meterStream.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      const AudioContextConstructor =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextConstructor) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const context = new AudioContextConstructor();
      if (context.state === "suspended") await context.resume();
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.72;
      context.createMediaStreamSource(stream).connect(analyser);
      const frequency = new Uint8Array(analyser.frequencyBinCount);
      const waveform = new Uint8Array(analyser.fftSize);
      meterStream.current = stream;
      meterContext.current = context;

      const average = (from: number, to: number) => {
        let sum = 0;
        for (let index = from; index < to; index++) sum += frequency[index];
        return sum / Math.max(1, to - from) / 255;
      };
      const measure = () => {
        analyser.getByteFrequencyData(frequency);
        analyser.getByteTimeDomainData(waveform);
        let squares = 0;
        for (const sample of waveform) {
          const value = (sample - 128) / 128;
          squares += value * value;
        }
        const rms = Math.min(1, Math.sqrt(squares / waveform.length) * 4.2);
        const bins = frequency.length;
        const next = {
          low: average(2, Math.floor(bins * 0.08)),
          mid: average(Math.floor(bins * 0.08), Math.floor(bins * 0.3)),
          high: average(Math.floor(bins * 0.3), Math.floor(bins * 0.72)),
        };
        const current = signal.current;
        const level = current.level * 0.68 + rms * 0.32;
        signal.current = {
          low: current.low * 0.7 + next.low * 0.3,
          mid: current.mid * 0.7 + next.mid * 0.3,
          high: current.high * 0.7 + next.high * 0.3,
          level,
          peak: Math.max(current.peak * 0.86, Math.max(0, level - current.level) * 7),
          updatedAt: Date.now(),
        };
        meterFrame.current = requestAnimationFrame(measure);
      };
      measure();
    } catch {
      // SpeechRecognition can still work even when a separate analyser stream is unavailable.
    }
  }, []);
  useEffect(() => {
    textCallback.current = onText;
    noticeCallback.current = onNotice;
  }, [onText, onNotice]);
  useEffect(() => {
    const w = window as unknown as SpeechWindow;
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    window.speechSynthesis?.getVoices();
    return () => {
      const r = recognition.current;
      if (r) {
        r.onresult = null;
        r.onend = null;
        r.onerror = null;
        r.onstart = r.onaudiostart = r.onaudioend = r.onspeechstart = r.onspeechend = null;
        r.abort();
      }
      stopMeter();
      window.speechSynthesis?.cancel();
    };
  }, [stopMeter]);
  const stop = useCallback(() => {
    if (recognition.current) {
      setMicPhase((phase) => microphoneTransition(phase, "stop"));
      recognition.current.stop();
    }
  }, []);
  const start = useCallback(async (language: Language) => {
    if (recognition.current) {
      setMicPhase((phase) => microphoneTransition(phase, "stop"));
      recognition.current.stop();
      return;
    }
    const w = window as unknown as SpeechWindow,
      Constructor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Constructor) {
      noticeCallback.current(
        "このブラウザでは音声入力を使えません。文字で入力してください。",
      );
      return;
    }
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setInterim("");
    setMicPhase("starting");
    await startMeter();
    const r = new Constructor();
    r.lang = LANGUAGES[language].locale;
    r.continuous = false;
    r.interimResults = true;
    const update = (event: Parameters<typeof microphoneTransition>[1]) => {
      if (recognition.current === r) setMicPhase((phase) => microphoneTransition(phase, event));
    };
    r.onstart = r.onaudiostart = () => update("ready");
    r.onspeechstart = () => update("speech");
    r.onspeechend = () => update("quiet");
    r.onaudioend = () => update("audioend");
    r.onresult = (e) => {
      if (recognition.current !== r) return;
      let final = "",
        draft = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else draft += e.results[i][0].transcript;
      }
      setInterim(draft);
      if (final) textCallback.current(final);
    };
    r.onerror = (e) => {
      if (recognition.current !== r) return;
      update("error");
      noticeCallback.current(
        e.error === "not-allowed"
          ? "マイクの利用が許可されていません。ブラウザの設定を確認してください。"
          : e.error === "no-speech"
            ? "音声を聞き取れませんでした。もう一度話してください。"
            : e.error === "language-not-supported"
              ? "この端末では選択した言語の音声入力に対応していません。文字で入力してください。"
              : "音声入力を続けられませんでした。文字入力も使えます。",
      );
    };
    r.onend = () => {
      if (recognition.current !== r) return;
      update("end");
      recognition.current = null;
      stopMeter();
      setListening(false);
      setInterim("");
    };
    recognition.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      recognition.current = null;
      stopMeter();
      setListening(false);
      setMicPhase("error");
      noticeCallback.current("マイクを開始できませんでした。");
    }
  }, [startMeter, stopMeter]);
  const speak = useCallback(
    (text: string, language: Language, slow = false) => {
      if (!window.speechSynthesis) {
        noticeCallback.current("この端末では読み上げを使えません。");
        return;
      }
      recognition.current?.abort();
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find((v) =>
        v.lang.replace("_", "-").toLowerCase().startsWith(language),
      );
      if (!voice) {
        noticeCallback.current(
          `${LANGUAGES[language].label}の読み上げ音声が端末にありません。訳文を大きく表示して相手に見せられます。`,
        );
        return;
      }
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = LANGUAGES[language].locale;
      u.voice = voice;
      u.rate = slow ? 0.7 : 0.95;
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(u);
    },
    [],
  );
  const silence = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);
  return {
    supported,
    micPhase,
    listening,
    speaking,
    interim,
    signal,
    start,
    stop,
    speak,
    silence,
  };
}
