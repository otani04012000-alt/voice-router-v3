"use client";
import { Mic, MicOff, Square, Check, LoaderCircle, Volume2 } from "lucide-react";
import { translateUi, type UiLanguage } from "./ui-language";
import type { MicrophonePhase } from "./microphone-state";
import "./secretary-presence.css";

type Props = {
  phase: MicrophonePhase;
  busy: boolean;
  speaking: boolean;
  delivered: boolean;
  uiLanguage: UiLanguage;
  onStop: () => void;
};

export default function SecretaryPresence({ phase, busy, speaking, delivered, uiLanguage, onStop }: Props) {
  const uiText = (value: string) => translateUi(uiLanguage, value);
  const active = ["starting", "listening", "speech", "stopping"].includes(phase);
  const micLabel = phase === "starting" ? "マイクを準備中" : phase === "listening" ? "マイク受付中" : phase === "speech" ? "声を聞き取っています" : phase === "stopping" ? "マイクを停止中" : phase === "stopped" ? "マイク停止済み" : phase === "error" ? "マイクを確認してください" : "マイクはオフ";
  const state = active || phase === "error" ? phase : busy ? "translating" : speaking ? "speaking" : delivered ? "delivered" : phase;
  const detail = phase === "error" ? "音声入力を続けられませんでした。文字入力も使えます。" : active ? (phase === "stopping" ? "音声入力の終了を待っています" : "話し終えたら停止できます") : busy ? "ことばを翻訳しています。" : speaking ? "訳文を読み上げています" : delivered ? "訳文ができました" : phase === "stopped" ? "もう声は受け付けていません" : "声でも文字でも、あなたのことばで";
  return (
    <aside className="voice-console" data-state={state} aria-label={uiText("音声入力の状態")}>
      <div className="voice-console-copy" role="status" aria-live="polite" aria-atomic="true">
        <span className="voice-console-label">{active ? <Mic size={13}/> : <MicOff size={13}/>} {uiText(micLabel)}</span>
        <span className="voice-console-detail">{uiText(detail)}</span>
      </div>
      <div className="voice-console-signal" aria-hidden="true">
        {busy && !active ? <LoaderCircle size={18} className="spin"/> : delivered && !active && !speaking ? <Check size={18}/> : speaking && !active ? <Volume2 size={18}/> : <div className="voice-console-wave">{Array.from({length:9},(_,i)=><i key={i}/>)}</div>}
      </div>
      {active && <button type="button" className="voice-console-stop" onClick={onStop} disabled={phase === "stopping"} aria-label={uiText("音声を停止")}><Square size={12}/>{uiText("停止")}</button>}
    </aside>
  );
}
