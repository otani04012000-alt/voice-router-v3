"use client";
import { useCallback, useEffect, useRef, useState } from "react";
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
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechWindow = {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
export function useVoice(
  onText: (text: string) => void,
  onNotice: (text: string) => void,
) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const textCallback = useRef(onText),
    noticeCallback = useRef(onNotice);
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
        r.abort();
      }
      window.speechSynthesis?.cancel();
    };
  }, []);
  const stop = useCallback(() => {
    recognition.current?.stop();
  }, []);
  const start = useCallback((language: Language) => {
    if (recognition.current) {
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
    const r = new Constructor();
    r.lang = LANGUAGES[language].locale;
    r.continuous = false;
    r.interimResults = true;
    r.onresult = (e) => {
      let final = "",
        draft = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else draft += e.results[i][0].transcript;
      }
      setInterim(draft);
      if (final) textCallback.current(final);
    };
    r.onerror = (e) =>
      noticeCallback.current(
        e.error === "not-allowed"
          ? "マイクの利用が許可されていません。ブラウザの設定を確認してください。"
          : e.error === "no-speech"
            ? "音声を聞き取れませんでした。もう一度話してください。"
            : e.error === "language-not-supported"
              ? "この端末では選択した言語の音声入力に対応していません。文字で入力してください。"
              : "音声入力を続けられませんでした。文字入力も使えます。",
      );
    r.onend = () => {
      if (recognition.current === r) recognition.current = null;
      setListening(false);
      setInterim("");
    };
    recognition.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      recognition.current = null;
      setListening(false);
      noticeCallback.current("マイクを開始できませんでした。");
    }
  }, []);
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
    listening,
    speaking,
    interim,
    start,
    stop,
    speak,
    silence,
  };
}
