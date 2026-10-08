"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { microphoneTransition, type MicrophonePhase } from "./microphone-state";
import { LANGUAGES, type Language } from "@/lib/translation";
import { selectSpeechVoice } from "./speech-voice";
import { planSpeech, playSpeechSequence } from "./speech-playback";

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
  const stoppedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechRun = useRef(0);
  const cancelPlayback = useRef<(() => void) | null>(null);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
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
      if (stoppedTimer.current) clearTimeout(stoppedTimer.current);
      const r = recognition.current;
      if (r) {
        r.onresult = null;
        r.onend = null;
        r.onerror = null;
        r.onstart = r.onaudiostart = r.onaudioend = r.onspeechstart = r.onspeechend = null;
        r.abort();
      }
      stopMeter();
      speechRun.current += 1;
      cancelPlayback.current?.();
      utterance.current = null;
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
    if (stoppedTimer.current) {
      clearTimeout(stoppedTimer.current);
      stoppedTimer.current = null;
    }
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
    speechRun.current += 1;
    cancelPlayback.current?.();
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
      if (recognition.current !== r) return;
      setMicPhase((phase) => {
        const next = microphoneTransition(phase, event);
        if (next === "stopped") {
          if (stoppedTimer.current) clearTimeout(stoppedTimer.current);
          stoppedTimer.current = setTimeout(() => {
            stoppedTimer.current = null;
            setMicPhase((current) => current === "stopped" ? "off" : current);
          }, 1800);
        }
        return next;
      });
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
    (
      text: string,
      language: Language,
      slow = false,
      onFinished?: () => void,
    ) => {
      if (!window.speechSynthesis) {
        noticeCallback.current("この端末では読み上げを使えません。");
        return;
      }
      recognition.current?.abort();
      const run = ++speechRun.current;
      cancelPlayback.current?.();
      const synthesis = window.speechSynthesis;
      synthesis.cancel();
      const segments = planSpeech(text, slow);
      setSpeaking(segments.length > 0);
      if (!segments.length) return;

      const play = async () => {
        let voices = synthesis.getVoices();
        if (voices.length === 0) {
          voices = await new Promise<SpeechSynthesisVoice[]>((resolve) => {
            let settled = false;
            const finish = () => {
              if (settled) return;
              settled = true;
              synthesis.removeEventListener("voiceschanged", finish);
              resolve(synthesis.getVoices());
            };
            synthesis.addEventListener("voiceschanged", finish, { once: true });
            window.setTimeout(finish, 900);
          });
        }
        if (speechRun.current !== run) return;

        const locale = LANGUAGES[language].locale;
        const selectedVoice = selectSpeechVoice(voices, locale);
        cancelPlayback.current = playSpeechSequence(segments, (segment, ended, failed) => {
          if (speechRun.current !== run) { failed(); return; }
          const u = new SpeechSynthesisUtterance(segment.text);
          u.lang = locale;
          if (selectedVoice) u.voice = selectedVoice;
          u.rate = segment.rate;
          u.onstart = () => {
            if (speechRun.current === run) setSpeaking(true);
          };
          u.onend = () => {
            if (speechRun.current !== run) return;
            utterance.current = null;
            ended();
          };
          u.onerror = (event) => {
            if (speechRun.current !== run) return;
            failed();
            utterance.current = null;
            setSpeaking(false);
            noticeCallback.current(
              event.error === "not-allowed"
                ? "読み上げが端末に止められました。音量を上げ、もう一度スピーカーボタンを押してください。"
                : `${LANGUAGES[language].label}を読み上げられませんでした。訳文を大きく表示して相手に見せられます。`,
            );
          };
          utterance.current = u;
          if (synthesis.paused) synthesis.resume();
          synthesis.speak(u);
        }, () => {
          if (speechRun.current !== run) return;
          cancelPlayback.current = null;
          setSpeaking(false);
          onFinished?.();
        });
      };

      void play();
    },
    [],
  );
  const silence = useCallback(() => {
    speechRun.current += 1;
    cancelPlayback.current?.();
    cancelPlayback.current = null;
    utterance.current = null;
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
