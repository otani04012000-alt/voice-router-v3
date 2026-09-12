"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownUp,
  ArrowRight,
  Bookmark,
  Check,
  ChevronRight,
  Copy,
  Download,
  Globe2,
  Languages,
  LoaderCircle,
  Maximize2,
  MessageCircle,
  Mic,
  RotateCcw,
  Send,
  Settings2,
  Shield,
  Sparkles,
  Square,
  Trash2,
  Users,
  Volume2,
  X,
} from "lucide-react";
import {
  isLanguage,
  isTranslation,
  LANGUAGES,
  MAX_TEXT,
  requestTranslation,
  TONES,
  type Language,
  type Tone,
  type Translation,
  type Turn,
} from "@/lib/translation";
import { useRoomSocket } from "@/app/secret-room/[roomId]/use-room-socket";
import type { RoomMessage } from "@/app/secret-room/[roomId]/types";
import { useVoice } from "./use-voice";
import "./studio.css";

const SAVED_KEY = "honyaku.saved.v1";
const HISTORY_KEY = "honyaku.history.v1";
const phrases = [
  {
    category: "出会い",
    text: "会えてうれしいです。ゆっくり話してもらえますか？",
    icon: "✦",
  },
  {
    category: "食事",
    text: "辛くしないでください。おすすめは何ですか？",
    icon: "◒",
  },
  {
    category: "移動",
    text: "ここまで行きたいです。料金はいくらですか？",
    icon: "↗",
  },
  {
    category: "気持ち",
    text: "うまく言えないけれど、ありがとうと伝えたいです。",
    icon: "♡",
  },
];
function readTurns(key: string): Turn[] {
  try {
    const data = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(data)
      ? data
          .filter(
            (t: Turn) =>
              typeof t.id === "string" &&
              Number.isFinite(t.createdAt) &&
              ["you", "partner"].includes(t.speaker) &&
              isTranslation(t),
          )
          .slice(-100)
      : [];
  } catch {
    return [];
  }
}
function time(value: number) {
  return new Date(value).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TranslationStudio({ roomId }: { roomId?: string }) {
  const remote = Boolean(roomId);
  const [myLanguage, setMyLanguage] = useState<Language>("ja");
  const [otherLanguage, setOtherLanguage] = useState<Language>("vi");
  const [speaker, setSpeaker] = useState<"you" | "partner">("you");
  const [tone, setTone] = useState<Tone>("natural");
  const [text, setText] = useState("");
  const [result, setResult] = useState<Turn | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [saved, setSaved] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState("");
  const [engine, setEngine] = useState<
    "loading" | "openrouter" | "mymemory" | "unavailable"
  >("loading");
  const [keepHistory, setKeepHistory] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [panel, setPanel] = useState<"saved" | "settings" | null>(null);
  const [present, setPresent] = useState<Turn | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [typing, setTyping] = useState(false);
  const [sentIds, setSentIds] = useState<string[]>([]);
  const abort = useRef<AbortController | null>(null);
  const backAbort = useRef<AbortController | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const presentDialog = useRef<HTMLDialogElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const lock = useRef(false);
  const source = speaker === "you" ? myLanguage : otherLanguage;
  const target = speaker === "you" ? otherLanguage : myLanguage;
  const voice = useVoice(
    useCallback((value: string) => {
      setResult(null);
      setText((t) => (t ? `${t} ${value}` : value).slice(0, MAX_TEXT));
    }, []),
    setNotice,
  );

  useEffect(() => {
    setMemberId(`member-${crypto.randomUUID()}`);
    setSaved(readTurns(SAVED_KEY));
    try {
      if (!remote && localStorage.getItem("honyaku.remember") === "yes") {
        setKeepHistory(true);
        setTurns(readTurns(HISTORY_KEY));
      }
    } catch {}
    const query = new URLSearchParams(window.location.search);
    const from = query.get("from"),
      to = query.get("to");
    if (isLanguage(from) && isLanguage(to) && from !== to) {
      setMyLanguage(from);
      setOtherLanguage(to);
    }
    const controller = new AbortController();
    fetch("/api/translate", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) =>
        setEngine(d.provider === "openrouter" ? "openrouter" : "mymemory"),
      )
      .catch(() => {
        if (!controller.signal.aborted) setEngine("unavailable");
      });
    return () => {
      controller.abort();
      abort.current?.abort();
      backAbort.current?.abort();
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (localTypingTimer.current) clearTimeout(localTypingTimer.current);
    };
  }, [remote]);
  useEffect(() => {
    if (remote || !keepHistory) return;
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(turns.slice(-100)));
    } catch {
      setNotice("この端末に履歴を保存できませんでした。");
    }
  }, [turns, keepHistory, remote]);
  useEffect(() => {
    if (panel) dialog.current?.showModal();
    else dialog.current?.close();
  }, [panel]);
  useEffect(() => {
    if (present) presentDialog.current?.showModal();
    else presentDialog.current?.close();
  }, [present]);
  useEffect(() => {
    if (turns.length)
      end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns.length]);

  const addTurn = useCallback(
    (turn: Turn) =>
      setTurns((current) =>
        current.some((t) => t.id === turn.id)
          ? current
          : [...current, turn].slice(-100),
      ),
    [],
  );
  const onMessage = useCallback(
    (message: RoomMessage) => {
      if (message.senderId === memberId) {
        setSentIds((ids) =>
          ids.includes(message.id) ? ids : [...ids, message.id],
        );
        setNotice("部屋への中継を確認しました。");
        return;
      }
      setTyping(false);
      if (message.translation && isTranslation(message.translation)) {
        const turn: Turn = {
          ...message.translation,
          id: message.id,
          createdAt: message.createdAt,
          speaker: "partner",
        };
        addTurn(turn);
        if (autoSpeak) {
          const mine =
            turn.source === myLanguage
              ? turn.original
              : turn.target === myLanguage
                ? turn.translated
                : null;
          if (mine) voice.speak(mine, myLanguage);
        }
      } else {
        // Compatibility with clients running PR #7: preserve the original without pretending it is translated.
        addTurn({
          id: message.id,
          createdAt: message.createdAt,
          speaker: "partner",
          original: message.body,
          translated: message.body,
          source: otherLanguage,
          target: otherLanguage,
          provider: "identity",
          toneApplied: false,
        });
      }
    },
    [memberId, addTurn, autoSpeak, myLanguage, otherLanguage, voice.speak],
  );
  const socket = useRoomSocket({
    enabled: remote && Boolean(memberId),
    roomId: roomId || "",
    memberId,
    memberName: LANGUAGES[myLanguage].native,
    onMessage,
    onPresence: (e) => {
      if (e.action === "left") setTyping(false);
    },
    onTyping: (e) => {
      setTyping(e.active);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (e.active)
        typingTimer.current = setTimeout(() => setTyping(false), 2500);
    },
    onError: setNotice,
  });
  const appendTranslation = async () => {
    if (lock.current || !text.trim()) return;
    lock.current = true;
    setBusy(true);
    setNotice("");
    voice.stop();
    backAbort.current?.abort();
    setChecking(false);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const translation = await requestTranslation(
        text.trim(),
        source,
        target,
        tone,
        controller.signal,
      );
      const turn: Turn = {
        ...translation,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        speaker,
      };
      setResult(turn);
      if (!remote) addTurn(turn);
      if (autoSpeak) voice.speak(turn.translated, turn.target);
    } catch (e) {
      if (!controller.signal.aborted)
        setNotice(e instanceof Error ? e.message : "翻訳できませんでした。");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const sendResult = () => {
    if (!result || sentIds.includes(result.id)) return;
    const ok = socket.sendMessage(
      result.original,
      result.id,
      result.createdAt,
      result,
    );
    if (ok) {
      addTurn(result);
      setNotice("送信しました。相手への中継を確認しています。");
      socket.sendTyping(false);
    } else
      setNotice(
        "まだ接続できていません。訳文は残っています。接続後にもう一度送れます。",
      );
  };
  const backTranslate = async () => {
    if (!result || checking) return;
    if (result.translated.length > MAX_TEXT) {
      setNotice("戻し訳の上限を超えています。短い文でお試しください。");
      return;
    }
    setChecking(true);
    const id = result.id;
    const controller = new AbortController();
    backAbort.current = controller;
    try {
      const back = await requestTranslation(
        result.translated,
        result.target,
        result.source,
        "natural",
        controller.signal,
      );
      setResult((t) =>
        t?.id === id ? { ...t, backTranslation: back.translated } : t,
      );
      setTurns((ts) =>
        ts.map((t) =>
          t.id === id ? { ...t, backTranslation: back.translated } : t,
        ),
      );
    } catch (e) {
      if (!controller.signal.aborted)
        setNotice(
          e instanceof Error ? e.message : "戻し訳を取得できませんでした。",
        );
    } finally {
      if (!controller.signal.aborted) setChecking(false);
    }
  };
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("コピーしました。");
    } catch {
      setNotice("コピーできませんでした。文字を選択してコピーしてください。");
    }
  };
  const save = (turn: Turn) => {
    const exists = saved.some(
      (t) =>
        t.original === turn.original &&
        t.source === turn.source &&
        t.target === turn.target,
    );
    const next = exists
      ? saved.filter(
          (t) =>
            !(
              t.original === turn.original &&
              t.source === turn.source &&
              t.target === turn.target
            ),
        )
      : [...saved, turn].slice(-100);
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      setSaved(next);
      setNotice(
        exists
          ? "フレーズ帳から外しました。"
          : "この端末のフレーズ帳に保存しました。",
      );
    } catch {
      setNotice("フレーズを保存できませんでした。");
    }
  };
  const share = () => {
    if (!roomId) {
      window.location.href = `/secret-room/${crypto.randomUUID()}?from=${myLanguage}&to=${otherLanguage}`;
      return;
    }
    const url = new URL(
      `/secret-room/${encodeURIComponent(roomId)}`,
      window.location.origin,
    );
    url.searchParams.set("from", otherLanguage);
    url.searchParams.set("to", myLanguage);
    void copy(url.toString());
  };
  const exportTurns = () => {
    const contents = turns
      .map(
        (t) =>
          `[${time(t.createdAt)}] ${LANGUAGES[t.source].label} → ${LANGUAGES[t.target].label}\n${t.original}\n${t.translated}`,
      )
      .join("\n\n");
    const url = URL.createObjectURL(
      new Blob([contents], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `翻訳王-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const changeLanguage = (side: "my" | "other", value: Language) => {
    voice.stop();
    voice.silence();
    setResult(null);
    if (side === "my") {
      setMyLanguage(value);
      if (value === otherLanguage) setOtherLanguage(myLanguage);
    } else {
      setOtherLanguage(value);
      if (value === myLanguage) setMyLanguage(otherLanguage);
    }
  };
  const reset = () => {
    setResult(null);
    setText("");
    textarea.current?.focus();
  };
  const savedResult =
    result &&
    saved.some(
      (t) =>
        t.original === result.original &&
        t.source === result.source &&
        t.target === result.target,
    );

  return (
    <main className="honyaku">
      <aside className="studio-rail">
        <Link href="/" className="brand-mark" aria-label="翻訳王 ホーム">
          <Languages size={24} />
        </Link>
        <div className="rail-items">
          <button
            className="rail-button active"
            aria-label="会話"
            onClick={() => setPanel(null)}
          >
            <MessageCircle size={21} />
            <span>会話</span>
          </button>
          <button
            className="rail-button"
            aria-label="フレーズ帳"
            onClick={() => setPanel("saved")}
          >
            <Bookmark size={21} />
            <span>フレーズ</span>
          </button>
          <button
            className="rail-button"
            aria-label="設定"
            onClick={() => setPanel("settings")}
          >
            <Settings2 size={21} />
            <span>設定</span>
          </button>
        </div>
        <div className="rail-bottom">
          <span>大谷企画</span>
          <small>TOKYO</small>
        </div>
      </aside>
      <div className="studio-body">
        <header className="studio-header">
          <Link href="/" className="wordmark">
            翻訳王<span>ことばを越えて。</span>
          </Link>
          <div className="header-actions">
            <span className="session-badge">
              <i />
              {remote
                ? socket.connectionState === "connected"
                  ? `${socket.members.length}人の部屋`
                  : "接続を準備中"
                : "対面で話す"}
            </span>
            <button className="outline-button" onClick={share}>
              <Users size={16} />
              {remote ? "招待リンクをコピー" : "離れた相手と話す"}
              <ArrowRight size={15} />
            </button>
          </div>
        </header>
        <div className="studio-content">
          <section className="intro">
            <div>
              <p className="eyebrow">
                <span />
                {remote
                  ? "ふたりだけの、秘密の部屋"
                  : "あなたと、目の前の誰かのために"}
              </p>
              <h1>
                ことばの向こうに、<em>人がいる。</em>
              </h1>
              <p className="intro-description">
                {remote
                  ? "それぞれの言葉で話して、同じ気持ちに近づく。"
                  : "話す。伝わる。会話が、もう一歩近くなる。"}
              </p>
            </div>
            <div className="language-orbit" aria-hidden="true">
              <span className="orbit-ring" />
              <span className="orbit-ring second" />
              <span className="orbit-word japanese">あ</span>
              <span className="orbit-word viet">à</span>
              <span className="orbit-word khmer">ក</span>
              <span className="orbit-star">✧</span>
            </div>
          </section>
          <section className="language-bar" aria-label="会話の言語">
            <label>
              <span>あなたのことば</span>
              <select
                aria-label="あなたの言語"
                disabled={busy || voice.listening}
                value={myLanguage}
                onChange={(e) =>
                  changeLanguage("my", e.target.value as Language)
                }
              >
                {Object.entries(LANGUAGES).map(([key, l]) => (
                  <option value={key} key={key}>
                    {l.native} · {l.label === l.native ? "JA" : l.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="swap-button"
              aria-label="言語を入れ替える"
              disabled={busy || voice.listening}
              onClick={() => {
                changeLanguage("my", otherLanguage);
                setText("");
              }}
            >
              <ArrowDownUp size={18} />
            </button>
            <label>
              <span>相手のことば</span>
              <select
                aria-label="相手の言語"
                disabled={busy || voice.listening}
                value={otherLanguage}
                onChange={(e) =>
                  changeLanguage("other", e.target.value as Language)
                }
              >
                {Object.entries(LANGUAGES).map(([key, l]) => (
                  <option value={key} key={key}>
                    {l.native} · {l.label === l.native ? "JA" : l.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="language-bar-note">
              <Globe2 size={17} />
              <span>
                それぞれの母語で
                <br />
                そのまま、話そう。
              </span>
            </div>
          </section>
          {notice && (
            <div className="studio-notice" role="status">
              <span>{notice}</span>
              <button
                aria-label="お知らせを閉じる"
                onClick={() => setNotice("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          <div className="workbench">
            <section className="input-card">
              <div className="card-heading">
                <span className="number-tag">01</span>
                <h2>伝えたいこと</h2>
                <span className="small-label">{LANGUAGES[source].native}</span>
              </div>
              {!remote && (
                <div className="speaker-switch" aria-label="話す人">
                  <button
                    disabled={busy || voice.listening}
                    className={speaker === "you" ? "selected" : ""}
                    onClick={() => {
                      setSpeaker("you");
                      reset();
                    }}
                  >
                    あなたが話す
                  </button>
                  <button
                    disabled={busy || voice.listening}
                    className={speaker === "partner" ? "selected" : ""}
                    onClick={() => {
                      setSpeaker("partner");
                      reset();
                    }}
                  >
                    {LANGUAGES[otherLanguage].native} · 相手が話す
                  </button>
                </div>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void appendTranslation();
                }}
              >
                <label className="sr-only" htmlFor="translation-input">
                  翻訳する文章
                </label>
                <textarea
                  ref={textarea}
                  id="translation-input"
                  value={text}
                  maxLength={MAX_TEXT}
                  disabled={busy}
                  lang={source}
                  placeholder={
                    source === "ja"
                      ? "うまく言おうとしなくていい。\nあなたの言葉で、どうぞ。"
                      : source === "vi"
                        ? "Hãy nói bằng ngôn ngữ của bạn…"
                        : source === "km"
                          ? "សូមសរសេរនៅទីនេះ…"
                          : "Say it in your own words…"
                  }
                  onChange={(e) => {
                    setText(e.target.value);
                    setResult(null);
                    if (remote) {
                      socket.sendTyping(Boolean(e.target.value));
                      if (localTypingTimer.current)
                        clearTimeout(localTypingTimer.current);
                      localTypingTimer.current = setTimeout(
                        () => socket.sendTyping(false),
                        1200,
                      );
                    }
                  }}
                  onKeyDown={(e) => {
                    if (
                      (e.metaKey || e.ctrlKey) &&
                      e.key === "Enter" &&
                      !e.nativeEvent.isComposing
                    ) {
                      e.preventDefault();
                      void appendTranslation();
                    }
                  }}
                />
                <div className="input-meta">
                  <span>
                    {voice.listening
                      ? voice.interim ||
                        "聞いています。話し終わったら停止してください。"
                      : "⌘ / Ctrl ＋ Enter で翻訳"}
                  </span>
                  <span>
                    {text.length} / {MAX_TEXT}
                  </span>
                </div>
                <div className="tone-row">
                  <span>伝え方</span>
                  <div>
                    {Object.entries(TONES).map(([key, value]) => (
                      <button
                        key={key}
                        type="button"
                        disabled={
                          busy || (engine !== "openrouter" && key !== "natural")
                        }
                        className={tone === key ? "tone active" : "tone"}
                        onClick={() => {
                          setTone(key as Tone);
                          setResult(null);
                        }}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="input-actions">
                  <button
                    className={`mic-button ${voice.listening ? "listening" : ""}`}
                    type="button"
                    disabled={busy || !voice.supported}
                    onClick={() => voice.start(source)}
                  >
                    {voice.listening ? <Square size={17} /> : <Mic size={18} />}
                    {voice.listening ? "音声を停止" : "声で入力"}
                  </button>
                  <button
                    className="translate-button"
                    type="submit"
                    disabled={busy || !text.trim() || voice.listening}
                  >
                    {busy ? (
                      <LoaderCircle size={18} className="spin" />
                    ) : (
                      <Sparkles size={17} />
                    )}
                    {busy
                      ? "ことばを翻訳中"
                      : myLanguage === "vi"
                        ? "Dịch · 翻訳"
                        : myLanguage === "km"
                          ? "បកប្រែ · 翻訳"
                          : myLanguage === "en"
                            ? "Translate"
                            : "翻訳する"}
                    {!busy && <ArrowRight size={17} />}
                  </button>
                </div>
              </form>
            </section>
            <section
              className={`output-card ${result ? "has-result" : ""}`}
              aria-busy={busy}
              aria-live="polite"
            >
              <div className="card-heading">
                <span className="number-tag">02</span>
                <h2>届くことば</h2>
                <span className="small-label">
                  {LANGUAGES[result?.target || target].native}
                </span>
              </div>
              {result ? (
                <>
                  <div className="translation-content">
                    <p lang={result.target} className="translated-text">
                      {result.translated}
                    </p>
                    <p className="original-caption" lang={result.source}>
                      {result.original}
                    </p>
                  </div>
                  {result.backTranslation && (
                    <div className="back-translation">
                      <span>
                        <RotateCcw size={13} />
                        戻し訳で確かめる
                      </span>
                      <p>{result.backTranslation}</p>
                      <small>
                        同じ翻訳サービスによる参考訳です。正確さの保証ではありません。
                      </small>
                    </div>
                  )}
                  <div className="result-tools">
                    <button
                      onClick={() =>
                        voice.speaking
                          ? voice.silence()
                          : voice.speak(result.translated, result.target)
                      }
                    >
                      {voice.speaking ? (
                        <Square size={16} />
                      ) : (
                        <Volume2 size={17} />
                      )}
                      {voice.speaking ? "停止" : "読み上げ"}
                    </button>
                    <button
                      aria-label="訳文をコピー"
                      onClick={() => void copy(result.translated)}
                    >
                      <Copy size={17} />
                    </button>
                    <button
                      aria-label={savedResult ? "保存を解除" : "フレーズを保存"}
                      onClick={() => save(result)}
                    >
                      {savedResult ? (
                        <Check size={17} />
                      ) : (
                        <Bookmark size={17} />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setPresent(result);
                        setFlipped(false);
                      }}
                    >
                      <Maximize2 size={16} />
                      相手に見せる
                    </button>
                  </div>
                  <div className="result-bottom">
                    <button
                      className="text-button"
                      disabled={checking || busy}
                      onClick={() => void backTranslate()}
                    >
                      {checking ? (
                        <LoaderCircle size={13} className="spin" />
                      ) : (
                        <RotateCcw size={13} />
                      )}
                      戻し訳
                    </button>
                    <span>
                      {result.provider === "openrouter"
                        ? "AI翻訳"
                        : result.provider === "mymemory"
                          ? "標準翻訳"
                          : "原文"}
                    </span>
                    {remote && (
                      <button
                        className="send-button"
                        disabled={
                          socket.connectionState !== "connected" ||
                          socket.members.length < 2 ||
                          sentIds.includes(result.id)
                        }
                        onClick={sendResult}
                      >
                        {sentIds.includes(result.id) ? (
                          <Check size={15} />
                        ) : (
                          <Send size={15} />
                        )}
                        {sentIds.includes(result.id)
                          ? "中継済み"
                          : socket.members.length < 2
                            ? "相手の入室待ち"
                            : myLanguage === "vi"
                              ? "Gửi · 送る"
                              : myLanguage === "km"
                                ? "ផ្ញើ · 送る"
                                : "相手に送る"}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="output-empty">
                  <div
                    className={`voice-glyph ${busy ? "working" : ""}`}
                    aria-hidden="true"
                  >
                    {[18, 35, 54, 28, 42, 66, 38, 24, 46, 30, 16].map(
                      (height, i) => (
                        <i
                          style={{ height, animationDelay: `${i * 90}ms` }}
                          key={i}
                        />
                      ),
                    )}
                  </div>
                  <p>
                    {busy
                      ? "あなたのことばを、つないでいます。"
                      : "あなたの気持ちが、ここから届く。"}
                  </p>
                  <span>
                    {busy
                      ? "もう少しだけ、お待ちください。"
                      : "翻訳すると、相手のことばで表示されます。"}
                  </span>
                </div>
              )}
            </section>
          </div>
          <div className="under-workbench">
            <span>
              <Shield size={13} />
              {remote
                ? "部屋の履歴はこの画面を閉じると消えます"
                : keepHistory
                  ? "履歴はこの端末に保存中"
                  : "履歴はこの画面の中だけ"}
            </span>
            <span>
              {engine === "openrouter"
                ? "AI翻訳 · 伝え方の調整に対応"
                : engine === "mymemory"
                  ? "標準翻訳 · MyMemory"
                  : engine === "loading"
                    ? "翻訳サービスを確認中"
                    : "翻訳サービスの確認ができませんでした"}
              <i className={engine === "unavailable" ? "offline" : ""} />
            </span>
          </div>
          <section className="conversation-section">
            <div className="section-heading">
              <h2>
                {turns.length ? "ふたりの会話" : "はじめのひとこと"}
                <span>
                  {turns.length
                    ? `${turns.length}件`
                    : "言葉に迷ったら、ここから。"}
                </span>
              </h2>
              {turns.length > 0 && (
                <button className="text-button" onClick={exportTurns}>
                  <Download size={15} />
                  書き出す
                </button>
              )}
            </div>
            {turns.length ? (
              <div
                className="conversation-log"
                role="log"
                aria-label="会話の履歴"
              >
                {turns.map((turn) => (
                  <article
                    className={`conversation-turn ${turn.speaker}`}
                    key={turn.id}
                  >
                    <div className="turn-avatar">
                      {LANGUAGES[turn.source].short}
                    </div>
                    <div className="turn-copy">
                      <div className="turn-meta">
                        <strong>
                          {turn.speaker === "you" ? "あなた" : "相手"}
                        </strong>
                        <span>
                          {LANGUAGES[turn.source].native} →{" "}
                          {LANGUAGES[turn.target].native}
                        </span>
                        <time>{time(turn.createdAt)}</time>
                      </div>
                      <p lang={turn.source}>{turn.original}</p>
                      <p lang={turn.target} className="turn-translation">
                        {turn.provider === "identity" && <small>原文 · </small>}
                        {turn.translated}
                      </p>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="この会話を大きく表示"
                      onClick={() => setPresent(turn)}
                    >
                      <Maximize2 size={15} />
                    </button>
                  </article>
                ))}
                {typing && (
                  <p className="typing-indicator">相手が入力しています…</p>
                )}
                <div ref={end} />
              </div>
            ) : (
              <div className="phrase-grid">
                {phrases.map((p) => (
                  <button
                    className="phrase-card"
                    key={p.category}
                    disabled={busy || voice.listening}
                    onClick={() => {
                      setSpeaker("you");
                      setMyLanguage("ja");
                      if (otherLanguage === "ja") setOtherLanguage("vi");
                      setText(p.text);
                      setResult(null);
                      textarea.current?.focus();
                    }}
                  >
                    <span className="phrase-category">
                      <i>{p.icon}</i>
                      {p.category}
                      <ChevronRight size={13} />
                    </span>
                    <span>{p.text}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
          <footer className="studio-footer">
            <span>
              翻訳王 <i>／</i> OTANI KIKAKU
            </span>
            <span>離れていても、ことばはそばに。</span>
            <Link href="/world-tree">
              世界樹 <ArrowRight size={12} />
            </Link>
          </footer>
        </div>
      </div>
      <dialog
        ref={dialog}
        className="studio-dialog"
        onCancel={() => setPanel(null)}
        onClose={() => setPanel(null)}
      >
        <div className="dialog-heading">
          <h2>{panel === "saved" ? "あなたのフレーズ帳" : "会話の設定"}</h2>
          <button
            className="icon-button"
            aria-label="閉じる"
            onClick={() => setPanel(null)}
          >
            <X size={21} />
          </button>
        </div>
        {panel === "saved" ? (
          <>
            <p className="dialog-description">
              この画面を開いていれば、保存した訳文は通信なしでも表示できます。
            </p>
            {saved.length ? (
              saved.map((t) => (
                <article className="saved-phrase" key={t.id}>
                  <span>
                    {LANGUAGES[t.source].label} → {LANGUAGES[t.target].label}
                  </span>
                  <p>{t.original}</p>
                  <p lang={t.target}>{t.translated}</p>
                  <div>
                    <button
                      className="text-button"
                      onClick={() => {
                        setPresent(t);
                        setPanel(null);
                      }}
                    >
                      <Maximize2 size={15} />
                      見せる
                    </button>
                    <button
                      className="text-button"
                      onClick={() => voice.speak(t.translated, t.target)}
                    >
                      <Volume2 size={15} />
                      読む
                    </button>
                    <button className="text-button" onClick={() => save(t)}>
                      <Trash2 size={15} />
                      削除
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="saved-empty">
                <Bookmark size={30} />
                <p>また伝えたい言葉を、残しておこう。</p>
                <small>訳文のしおりボタンから保存できます。</small>
              </div>
            )}
          </>
        ) : (
          <>
            <label className="setting-row">
              <span>
                訳文を自動で読み上げる
                <small>端末に対応する音声がある言語で使えます。</small>
              </span>
              <input
                type="checkbox"
                checked={autoSpeak}
                onChange={(e) => setAutoSpeak(e.target.checked)}
              />
            </label>
            {!remote && (
              <label className="setting-row">
                <span>
                  会話をこの端末に残す
                  <small>オフにすると、保存済みの会話履歴も削除します。</small>
                </span>
                <input
                  type="checkbox"
                  checked={keepHistory}
                  onChange={(e) => {
                    try {
                      localStorage.setItem(
                        "honyaku.remember",
                        e.target.checked ? "yes" : "no",
                      );
                      if (!e.target.checked)
                        localStorage.removeItem(HISTORY_KEY);
                      setKeepHistory(e.target.checked);
                    } catch {
                      setNotice("保存設定を変更できませんでした。");
                    }
                  }}
                />
              </label>
            )}
            <div className="privacy-note">
              <Shield size={20} />
              <div>
                <h3>会話とプライバシー</h3>
                <p>
                  翻訳する文章は
                  {engine === "openrouter"
                    ? "OpenRouterと選択されたAI提供元"
                    : "MyMemory"}
                  へ送信されます。音声入力はブラウザの音声認識サービスを利用する場合があります。
                </p>
                <p>
                  秘密の部屋はURLを知る人が参加できます。通信は暗号化されますが、エンドツーエンド暗号化ではありません。サーバーには会話履歴を保存しません。フレーズ帳と書き出したファイルは削除するまで残ります。
                </p>
              </div>
            </div>
            <button
              className="outline-button danger"
              onClick={() => {
                setTurns([]);
                setResult(null);
                setText("");
                try {
                  localStorage.removeItem(HISTORY_KEY);
                } catch {}
                setPanel(null);
                setNotice("この画面の会話を消去しました。");
              }}
            >
              <Trash2 size={16} />
              この画面の会話を消去
            </button>
          </>
        )}
      </dialog>
      <dialog
        ref={presentDialog}
        className={`presentation-dialog ${flipped ? "flipped" : ""}`}
        onCancel={() => setPresent(null)}
        onClose={() => setPresent(null)}
      >
        {present && (
          <>
            <div className="presentation-toolbar">
              <span>{LANGUAGES[present.target].native}</span>
              <div>
                <button
                  className="icon-button"
                  aria-label="相手に向けて180度回転"
                  onClick={() => setFlipped((v) => !v)}
                >
                  <RotateCcw size={20} />
                </button>
                <button
                  className="icon-button"
                  aria-label="大きな表示を閉じる"
                  onClick={() => setPresent(null)}
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            <div className="presentation-words">
              <p lang={present.target}>{present.translated}</p>
              <small lang={present.source}>{present.original}</small>
            </div>
            <div className="presentation-actions">
              <button
                className="outline-button"
                onClick={() =>
                  voice.speak(present.translated, present.target, true)
                }
              >
                <Volume2 size={18} />
                ゆっくり読む
              </button>
              {!remote && (
                <button
                  className="translate-button"
                  disabled={busy}
                  onClick={() => {
                    setSpeaker(present.speaker === "you" ? "partner" : "you");
                    setMyLanguage(
                      present.speaker === "you"
                        ? present.source
                        : present.target,
                    );
                    setOtherLanguage(
                      present.speaker === "you"
                        ? present.target
                        : present.source,
                    );
                    setPresent(null);
                    reset();
                  }}
                >
                  返事をする · Reply <ArrowRight size={18} />
                </button>
              )}
            </div>
          </>
        )}
      </dialog>
    </main>
  );
}
