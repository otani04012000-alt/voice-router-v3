"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownUp,
  ArrowRight,
  Bell,
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
  UserRound,
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
import { UI_LANGUAGES, isUiLanguage, resolveUiLanguage, translateUi, type UiLanguage } from "./ui-language";
import SecretaryPresence from "./secretary-presence";
import "./studio.css";

const SAVED_KEY = "honyaku.saved.v1";
const HISTORY_KEY = "honyaku.history.v1";
const ROOM_NAME_KEY = "honyaku.room.name.v1";
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
              (t.senderName === undefined || typeof t.senderName === "string") &&
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
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>("ja");
  const uiText = (value: string) => translateUi(uiLanguage, value);
  const changeUiLanguage = (value: UiLanguage) => {
    setUiLanguage(value);
    try { localStorage.setItem("honyaku.ui-language", value); } catch {}
  };
  const [myLanguage, setMyLanguage] = useState<Language>("ja");
  const [otherLanguage, setOtherLanguage] = useState<Language>("zh");
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
  const [conversationMode, setConversationMode] = useState(false);
  const [voiceSubmission, setVoiceSubmission] = useState(0);
  const [swapping, setSwapping] = useState(false);
  const [panel, setPanel] = useState<"saved" | "settings" | null>(null);
  const [present, setPresent] = useState<Turn | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberNameDraft, setMemberNameDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [typingName, setTypingName] = useState("");
  const [sentIds, setSentIds] = useState<string[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>("default");
  const abort = useRef<AbortController | null>(null);
  const backAbort = useRef<AbortController | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const presentDialog = useRef<HTMLDialogElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const lock = useRef(false);
  const conversationModeRef = useRef(false);
  const source = speaker === "you" ? myLanguage : otherLanguage;
  const target = speaker === "you" ? otherLanguage : myLanguage;
  const voice = useVoice(
    useCallback((value: string) => {
      setResult(null);
      setText((t) => (t ? `${t} ${value}` : value).slice(0, MAX_TEXT));
      if (conversationModeRef.current)
        setVoiceSubmission((submission) => submission + 1);
    }, []),
    setNotice,
  );

  useEffect(() => {
    setMemberId(`member-${crypto.randomUUID()}`);
    setSaved(readTurns(SAVED_KEY));
    try {
      if ("Notification" in window)
        setNotificationPermission(Notification.permission);
      if (remote) {
        const rememberedName = sessionStorage.getItem(ROOM_NAME_KEY)?.trim();
        if (rememberedName) {
          setMemberName(rememberedName);
          setMemberNameDraft(rememberedName);
        }
      }
      if (!remote && localStorage.getItem("honyaku.remember") === "yes") {
        setKeepHistory(true);
        setTurns(readTurns(HISTORY_KEY));
      }
    } catch {}
    const query = new URLSearchParams(window.location.search);
    try {
      setUiLanguage(resolveUiLanguage(query, localStorage.getItem("honyaku.ui-language"), navigator.language));
    } catch { setUiLanguage(resolveUiLanguage(query, null, navigator.language)); }
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
      if (swapTimer.current) clearTimeout(swapTimer.current);
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
  useEffect(() => {
    document.title = unreadCount
      ? `(${unreadCount}) ${translateUi(uiLanguage, "翻訳王")} | ${translateUi(uiLanguage, "新着")}`
      : `${translateUi(uiLanguage, "翻訳王")} | ${translateUi(uiLanguage, "ことばを越えて。")}`;
    return () => {
      document.title = "翻訳王 | ことばを越えて。";
    };
  }, [unreadCount, uiLanguage]);

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
      setTypingName("");
      setUnreadCount((count) => count + 1);
      setNotice(`${message.senderName}さんから新着メッセージが届きました。`);
      navigator.vibrate?.(120);
      if (
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        new Notification(`${translateUi(uiLanguage, "翻訳王")} | ${translateUi(uiLanguage, "新着")}`, {
          body: translateUi(uiLanguage, `${message.senderName}さんからメッセージが届きました。`),
          tag: `honyaku-${message.id}`,
        });
      }
      if (message.translation && isTranslation(message.translation)) {
        const turn: Turn = {
          ...message.translation,
          id: message.id,
          createdAt: message.createdAt,
          senderName: message.senderName,
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
          senderName: message.senderName,
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
    [memberId, addTurn, autoSpeak, myLanguage, otherLanguage, voice.speak, uiLanguage],
  );
  const socket = useRoomSocket({
    enabled: remote && Boolean(memberId) && Boolean(memberName),
    roomId: roomId || "",
    memberId,
    memberName,
    onMessage,
    onPresence: (e) => {
      if (e.action === "left") {
        setTyping(false);
        setTypingName("");
      }
      setNotice(
        `${e.member.name}さんが${e.action === "joined" ? "入室" : "退室"}しました。`,
      );
    },
    onTyping: (e) => {
      setTyping(e.active);
      setTypingName(e.active ? e.memberName : "");
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
  useEffect(() => {
    if (!voiceSubmission) return;
    void appendTranslation();
    // A new final speech-recognition result is the intentional trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceSubmission]);
  const toggleConversationMode = () => {
    const next = !conversationMode;
    conversationModeRef.current = next;
    setConversationMode(next);
    setAutoSpeak(next);
    setNotice(
      next
        ? "会話モードを開始しました。話し終えると、自動で翻訳して読み上げます。"
        : "会話モードを終了しました。",
    );
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
      window.location.href = `/secret-room/${crypto.randomUUID()}?from=${myLanguage}&to=${otherLanguage}&ui=${uiLanguage}`;
      return;
    }
    const url = new URL(
      `/secret-room/${encodeURIComponent(roomId)}`,
      window.location.origin,
    );
    url.searchParams.set("from", otherLanguage);
    url.searchParams.set("to", myLanguage);
    url.searchParams.set("ui", isUiLanguage(otherLanguage) ? otherLanguage : uiLanguage);
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

  const enterRoom = () => {
    const name = memberNameDraft.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!name) {
      setNotice("入室する名前を入力してください。");
      return;
    }
    sessionStorage.setItem(ROOM_NAME_KEY, name);
    setMemberName(name);
    setMemberNameDraft(name);
    setNotice(`${name}さんとして入室します。`);
  };
  const requestNotifications = async () => {
    if (!("Notification" in window)) {
      setNotice("このブラウザは端末通知に対応していません。画面内では新着を表示します。");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    setNotice(
      permission === "granted"
        ? "新着の端末通知をオンにしました。"
        : "端末通知はオフです。新着は画面内で確認できます。",
    );
  };
  const markMessagesRead = () => {
    setUnreadCount(0);
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <main className="honyaku" lang={uiLanguage === "zh" ? "zh-CN" : uiLanguage} data-ui-language={uiLanguage} data-conversation-state={busy ? "translating" : voice.listening ? "listening" : result ? "delivered" : "idle"}>
      <aside className="studio-rail">
        <Link href="/" className="brand-mark" aria-label={uiText("翻訳王 ホーム")}>
          <Languages size={24} />
        </Link>
        <div className="rail-items">
          <button
            className="rail-button active"
            aria-label={uiText("会話")}
            onClick={() => setPanel(null)}
          >
            <MessageCircle size={21} />
            <span>{uiText("会話")}</span>
          </button>
          <button
            className="rail-button"
            aria-label={uiText("フレーズ帳")}
            onClick={() => setPanel("saved")}
          >
            <Bookmark size={21} />
            <span>{uiText("フレーズ")}</span>
          </button>
          <button
            className="rail-button"
            aria-label={uiText("設定")}
            onClick={() => setPanel("settings")}
          >
            <Settings2 size={21} />
            <span>{uiText("設定")}</span>
          </button>
        </div>
        <div className="rail-bottom">
          <span>{uiText("大谷企画")}</span>
          <small>TOKYO</small>
        </div>
      </aside>
      <div className="studio-body">
        <header className="studio-header">
          <Link href="/" className="wordmark">{uiText("翻訳王")}<span>{uiText("ことばを越えて。")}</span>
          </Link>
          <div className="header-actions">
            <span className="session-badge">
              <i />
              {remote
                ? socket.connectionState === "connected"
                  ? uiText(`${socket.members.length}人の部屋`)
                  : uiText("接続を準備中")
                : uiText("対面で話す")}
            </span>
            <button className="outline-button" onClick={share}>
              <Users size={16} />
              {remote ? uiText("招待リンクをコピー") : uiText("離れた相手と話す")}
              <ArrowRight size={15} />
            </button>
            <div className="ui-language-switch" role="group" aria-label={uiText("画面の表示言語")}>
              <span className="ui-language-label"><Globe2 size={15} aria-hidden="true" />{uiText("画面の表示言語")}</span>
              {UI_LANGUAGES.map(({ value, label }) => (
                <button key={value} type="button" lang={value} aria-pressed={uiLanguage === value} onClick={() => changeUiLanguage(value)}>{label}</button>
              ))}
            </div>
          </div>
        </header>
        {remote && !memberName && (
          <div className="room-entry-layer">
            <form
              className="room-entry-card"
              onSubmit={(event) => {
                event.preventDefault();
                enterRoom();
              }}
            >
              <span className="room-entry-icon" aria-hidden="true">
                <UserRound size={24} />
              </span>
              <p className="eyebrow"><span />{uiText("秘密の部屋へ入る")}</p>
              <h1>{uiText("誰がいるか、名前でわかる部屋です。")}</h1>
              <p>{uiText("相手の画面にも表示する名前を入力してください。部屋の履歴と同じく、サーバーには保存しません。")}</p>
              <label htmlFor="room-member-name">{uiText("あなたの表示名")}</label>
              <input
                id="room-member-name"
                name="room-member-name"
                autoComplete="nickname"
                autoFocus
                maxLength={40}
                value={memberNameDraft}
                onChange={(event) => setMemberNameDraft(event.target.value)}
                placeholder={uiText("例：大谷")}
              />
              <button type="submit" disabled={!memberNameDraft.trim()}>
                <Users size={17} />{uiText("この名前で入室")}</button>
            </form>
          </div>
        )}
        <div className="studio-content">
          {remote && memberName && (
            <section className="room-members" aria-label={uiText("入室中の参加者")}>
              <div className="room-members-heading">
                <span><Users size={15} />{uiText("入室中")}</span>
                <small>{uiText("名前を確認できる人だけが会話に参加しています")}</small>
              </div>
              <div className="room-member-list">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    className="room-new-message"
                    onClick={markMessagesRead}
                  >
                    <Bell size={13} />{uiText(`新着 ${unreadCount}件を見る`)}</button>
                )}
                {socket.members.map((member) => (
                  <span className="room-member" key={member.id}>
                    <i aria-hidden="true" />
                    {member.name}
                    {member.id === memberId && <small>{uiText("あなた")}</small>}
                  </span>
                ))}
                {socket.connectionState !== "connected" && (
                  <span className="room-member pending">{uiText("接続を確認中")}</span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    sessionStorage.removeItem(ROOM_NAME_KEY);
                    setMemberName("");
                    setMemberNameDraft("");
                  }}
                >{uiText("名前を変更")}</button>
                {notificationPermission !== "granted" && (
                  <button type="button" onClick={requestNotifications}>
                    <Bell size={12} />{uiText("新着通知をオン")}</button>
                )}
              </div>
            </section>
          )}
          <section className="intro">
            <div>
              <p className="eyebrow">
                <span />
                {remote
                  ? uiText("ふたりだけの、秘密の部屋")
                  : uiText("あなたと、目の前の誰かのために")}
              </p>
              <h1><span className="title-phrase">{uiText("ことばの向こうに、")}</span><em>{uiText("人がいる。")}</em>
              </h1>
              <p className="intro-description">
                {remote
                  ? uiText("それぞれの言葉で話して、同じ気持ちに近づく。")
                  : uiText("話す。伝わる。会話が、もう一歩近くなる。")}
              </p>
            </div>
            <div className="language-orbit" aria-hidden="true">
              <span className="orbit-ring" />
              <span className="orbit-ring second" />
              <span className="orbit-word japanese">あ</span>
              <span className="orbit-word viet">à</span>
              <span className="orbit-word khmer">ក</span>
              <span className="orbit-word chinese">中</span>
              <span className="orbit-star">✧</span>
            </div>
          </section>
          <div className="language-bridge" aria-hidden="true">
            <span>{LANGUAGES[source].native}</span>
            <div><i /><i /><i /><i /><i /><i /><i /></div>
            <span>{LANGUAGES[target].native}</span>
          </div>
          <section
            className={`language-bar ${swapping ? "swapping" : ""}`}
            aria-label={uiText("会話の言語")}
          >
            <label>
              <span>{uiText("あなたのことば")}</span>
              <select
                aria-label={uiText("あなたの言語")}
                disabled={busy || voice.listening}
                value={myLanguage}
                onChange={(e) =>
                  changeLanguage("my", e.target.value as Language)
                }
              >
                {Object.entries(LANGUAGES).map(([key, l]) => (
                  <option value={key} key={key}>
                    {l.native}{l.label === l.native ? " · JA" : uiText(l.label) === l.native ? "" : ` · ${uiText(l.label)}`}
                  </option>
                ))}
              </select>
            </label>
            <button
              className={`swap-button ${swapping ? "swapping" : ""}`}
              aria-label={uiText("言語を入れ替える")}
              disabled={busy || voice.listening}
              onClick={() => {
                if (swapTimer.current) clearTimeout(swapTimer.current);
                setSwapping(true);
                changeLanguage("my", otherLanguage);
                setText("");
                swapTimer.current = setTimeout(() => setSwapping(false), 620);
              }}
            >
              <ArrowDownUp size={18} />
            </button>
            <label>
              <span>{uiText("相手のことば")}</span>
              <select
                aria-label={uiText("相手の言語")}
                disabled={busy || voice.listening}
                value={otherLanguage}
                onChange={(e) =>
                  changeLanguage("other", e.target.value as Language)
                }
              >
                {Object.entries(LANGUAGES).map(([key, l]) => (
                  <option value={key} key={key}>
                    {l.native}{l.label === l.native ? " · JA" : uiText(l.label) === l.native ? "" : ` · ${uiText(l.label)}`}
                  </option>
                ))}
              </select>
            </label>
            <div className="language-bar-note">
              <Globe2 size={17} />
              <span>{uiText("それぞれの母語で")}<br />{uiText("そのまま、話そう。")}</span>
            </div>
          </section>
          {notice && (
            <div className="studio-notice" role="status">
              <span>{uiText(notice)}</span>
              <button
                aria-label={uiText("お知らせを閉じる")}
                onClick={() => setNotice("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          <div className="workbench">
            <section
              className={`input-card ${voice.listening ? "is-listening" : ""}`}
            >
              <div className="card-heading">
                <span className="number-tag">01</span>
                <h2>{uiText("伝えたいこと")}</h2>
                <span className="small-label">{LANGUAGES[source].native}</span>
              </div>
              {!remote && (
                <div className="speaker-switch" aria-label={uiText("話す人")}>
                  <button
                    disabled={busy || voice.listening}
                    className={speaker === "you" ? "selected" : ""}
                    onClick={() => {
                      setSpeaker("you");
                      reset();
                    }}
                  >{uiText("あなたが話す")}</button>
                  <button
                    disabled={busy || voice.listening}
                    className={speaker === "partner" ? "selected" : ""}
                    onClick={() => {
                      setSpeaker("partner");
                      reset();
                    }}
                  >
                    {LANGUAGES[otherLanguage].native}{uiText("· 相手が話す")}</button>
                </div>
              )}
              <button
                type="button"
                className={`conversation-mode-toggle ${conversationMode ? "active" : ""}`}
                aria-pressed={conversationMode}
                onClick={toggleConversationMode}
                disabled={busy || voice.listening}
              >
                <span className="mode-signal" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                <span className="mode-copy">
                  <strong>{uiText("会話モード")}</strong>
                  <small>
                    {conversationMode
                      ? uiText("声を聞いたら、自動翻訳して読み上げます")
                      : uiText("声で入力 → 翻訳 → 読み上げをひとつに")}
                  </small>
                </span>
                <span className="mode-switch" aria-hidden="true">
                  <i />
                </span>
              </button>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void appendTranslation();
                }}
              >
                <label className="sr-only" htmlFor="translation-input">{uiText("翻訳する文章")}</label>
                <textarea
                  ref={textarea}
                  id="translation-input"
                  value={text}
                  maxLength={MAX_TEXT}
                  disabled={busy}
                  lang={source}
                  placeholder={
                    source === "ja"
                      ? uiText("うまく言おうとしなくていい。\nあなたの言葉で、どうぞ。")
                      : source === "vi"
                        ? "Hãy nói bằng ngôn ngữ của bạn…"
                        : source === "km"
                          ? "សូមសរសេរនៅទីនេះ…"
                          : source === "zh"
                            ? uiText("请用你自己的语言说…")
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
                      ? voice.micPhase === "starting" ? uiText("マイクを準備中")
                        : voice.micPhase === "stopping" ? uiText("マイクを停止中")
                        : voice.micPhase === "stopped" ? uiText("マイク停止済み")
                        : voice.micPhase === "error" ? uiText("マイクを確認してください")
                        : voice.interim || uiText("聞いています。話し終わったら停止してください。")
                      : uiText("⌘ / Ctrl ＋ Enter で翻訳")}
                  </span>
                  <span>
                    {text.length} / {MAX_TEXT}
                  </span>
                </div>
                <div className="tone-row">
                  <span>{uiText("伝え方")}</span>
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
                        {uiText(value)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="input-actions">
                  <button
                    className={`mic-button ${voice.listening ? "listening" : ""}`}
                    type="button"
                    disabled={(busy && !voice.listening) || !voice.supported || voice.micPhase === "stopping"}
                    onClick={() => voice.start(source)}
                  >
                    {voice.micPhase === "speech" ? (
                      <span className="live-voice-bars" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                        <i />
                      </span>
                    ) : (
                      <Mic size={18} />
                    )}
                    {voice.micPhase === "stopping" ? uiText("マイクを停止中") : voice.listening ? uiText("音声を停止") : uiText("声で入力")}
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
                    {busy ? uiText("ことばを翻訳中") : uiText("翻訳する")}
                    {!busy && <ArrowRight size={17} />}
                  </button>
                </div>
                <SecretaryPresence phase={voice.micPhase} busy={busy} speaking={voice.speaking} delivered={Boolean(result)} uiLanguage={uiLanguage} onStop={voice.stop} />
              </form>
            </section>
            <section
              className={`output-card ${result ? "has-result" : ""}`}
              aria-busy={busy}
              aria-live="polite"
            >
              <div className="card-heading">
                <span className="number-tag">02</span>
                <h2>{uiText("届くことば")}</h2>
                <span className="small-label">
                  {LANGUAGES[result?.target || target].native}
                </span>
              </div>
              {result ? (
                <>
                  <div
                    className="delivery-sparks"
                    key={result.id}
                    aria-hidden="true"
                  >
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
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
                        <RotateCcw size={13} />{uiText("戻し訳で確かめる")}</span>
                      <p>{result.backTranslation}</p>
                      <small>{uiText("同じ翻訳サービスによる参考訳です。正確さの保証ではありません。")}</small>
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
                      {voice.speaking ? uiText("停止") : uiText("読み上げ")}
                    </button>
                    <button
                      aria-label={uiText("訳文をコピー")}
                      onClick={() => void copy(result.translated)}
                    >
                      <Copy size={17} />{uiText("コピー")}
                    </button>
                    <button
                      aria-label={savedResult ? uiText("保存を解除") : uiText("フレーズを保存")}
                      onClick={() => save(result)}
                    >
                      {savedResult ? (
                        <Check size={17} />
                      ) : (
                        <Bookmark size={17} />
                      )}{savedResult ? uiText("保存済み") : uiText("保存")}
                    </button>
                    <button
                      onClick={() => {
                        setPresent(result);
                        setFlipped(false);
                      }}
                    >
                      <Maximize2 size={16} />{uiText("相手に見せる")}</button>
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
                      )}{uiText("戻し訳")}</button>
                    <span>
                      {result.provider === "openrouter"
                        ? uiText("AI翻訳")
                        : result.provider === "mymemory"
                          ? uiText("標準翻訳")
                          : uiText("原文")}
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
                          ? uiText("中継済み")
                          : socket.members.length < 2
                            ? uiText("相手の入室待ち")
                            : uiText("相手に送る")}

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
                      ? uiText("あなたのことばを、つないでいます。")
                      : uiText("あなたの気持ちが、ここから届く。")}
                  </p>
                  <span>
                    {busy
                      ? uiText("もう少しだけ、お待ちください。")
                      : uiText("翻訳すると、相手のことばで表示されます。")}
                  </span>
                </div>
              )}
            </section>
          </div>
          <div className="under-workbench">
            <span>
              <Shield size={13} />
              {remote
                ? uiText("部屋の履歴はこの画面を閉じると消えます")
                : keepHistory
                  ? uiText("履歴はこの端末に保存中")
                  : uiText("履歴はこの画面の中だけ")}
            </span>
            <span>
              {engine === "openrouter"
                ? uiText("AI翻訳 · 伝え方の調整に対応")
                : engine === "mymemory"
                  ? uiText("標準翻訳 · MyMemory")
                  : engine === "loading"
                    ? uiText("翻訳サービスを確認中")
                    : uiText("翻訳サービスの確認ができませんでした")}
              <i className={engine === "unavailable" ? "offline" : ""} />
            </span>
          </div>
          <section className="conversation-section">
            <div className="section-heading">
              <h2>
                {turns.length ? uiText("ふたりの会話") : uiText("はじめのひとこと")}
                <span>
                  {turns.length
                    ? uiText(`${turns.length}件`)
                    : uiText("言葉に迷ったら、ここから。")}
                </span>
              </h2>
              {turns.length > 0 && (
                <button className="text-button" onClick={exportTurns}>
                  <Download size={15} />{uiText("書き出す")}</button>
              )}
            </div>
            {turns.length ? (
              <div
                className="conversation-log"
                role="log"
                aria-label={uiText("会話の履歴")}
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
                          {turn.senderName || (turn.speaker === "you" ? memberName || uiText("あなた") : uiText("相手"))}
                        </strong>
                        <span>
                          {LANGUAGES[turn.source].native} →{" "}
                          {LANGUAGES[turn.target].native}
                        </span>
                        <time>{time(turn.createdAt)}</time>
                      </div>
                      <p lang={turn.target} className="turn-translation">
                        <span className="message-caption">{uiText(turn.provider === "identity" ? "原文" : "訳文")}</span>
                        {turn.translated}
                      </p>
                      {turn.provider !== "identity" && (
                        <p lang={turn.source} className="turn-original">
                          <span className="message-caption">{uiText("原文")}</span>
                          {turn.original}
                        </p>
                      )}
                    </div>
                    <button
                      className="icon-button"
                      aria-label={uiText("この会話を大きく表示")}
                      onClick={() => setPresent(turn)}
                    >
                      <Maximize2 size={15} />
                    </button>
                  </article>
                ))}
                {typing && (
                  <p className="typing-indicator">
                    {typingName || uiText("相手")}{uiText("さんが入力しています…")}</p>
                )}
                <div ref={end} />
              </div>
            ) : (
              <div className="phrase-grid">
                {phrases.map((p) => (
                  <button
                    className="phrase-card"
                    key={uiText(p.category)}
                    disabled={busy || voice.listening}
                    onClick={() => {
                      setSpeaker("you");
                      setMyLanguage(uiLanguage);
                      if (otherLanguage === uiLanguage) setOtherLanguage(uiLanguage === "ja" ? "zh" : "ja");
                      setText(uiText(p.text));
                      setResult(null);
                      textarea.current?.focus();
                    }}
                  >
                    <span className="phrase-category">
                      <i>{p.icon}</i>
                      {uiText(p.category)}
                      <ChevronRight size={13} />
                    </span>
                    <span>{uiText(p.text)}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
          <footer className="studio-footer">
            <span>{uiText("翻訳王")}<i>／</i> OTANI KIKAKU
            </span>
            <span>{uiText("離れていても、ことばはそばに。")}</span>
            <Link href="/world-tree">{uiText("世界樹")}<ArrowRight size={12} />
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
          <h2>{panel === "saved" ? uiText("あなたのフレーズ帳") : uiText("会話の設定")}</h2>
          <button
            className="icon-button"
            aria-label={uiText("閉じる")}
            onClick={() => setPanel(null)}
          >
            <X size={21} />
          </button>
        </div>
        {panel === "saved" ? (
          <>
            <p className="dialog-description">{uiText("この画面を開いていれば、保存した訳文は通信なしでも表示できます。")}</p>
            {saved.length ? (
              saved.map((t) => (
                <article className="saved-phrase" key={t.id}>
                  <span>
                    {uiText(LANGUAGES[t.source].label)} → {uiText(LANGUAGES[t.target].label)}
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
                      <Maximize2 size={15} />{uiText("見せる")}</button>
                    <button
                      className="text-button"
                      onClick={() => voice.speak(t.translated, t.target)}
                    >
                      <Volume2 size={15} />{uiText("読む")}</button>
                    <button className="text-button" onClick={() => save(t)}>
                      <Trash2 size={15} />{uiText("削除")}</button>
                  </div>
                </article>
              ))
            ) : (
              <div className="saved-empty">
                <Bookmark size={30} />
                <p>{uiText("また伝えたい言葉を、残しておこう。")}</p>
                <small>{uiText("訳文のしおりボタンから保存できます。")}</small>
              </div>
            )}
          </>
        ) : (
          <>
            <label className="setting-row">
              <span>{uiText("訳文を自動で読み上げる")}<small>{uiText("端末に対応する音声がある言語で使えます。")}</small>
              </span>
              <input
                type="checkbox"
                checked={autoSpeak}
                onChange={(e) => setAutoSpeak(e.target.checked)}
              />
            </label>
            {remote && (
              <div className="setting-row">
                <span>{uiText("新着を端末に通知する")}<small>{uiText("相手が送信を完了したとき、画面外でも名前つきで知らせます。")}</small>
                </span>
                <button
                  type="button"
                  className="notification-setting"
                  onClick={requestNotifications}
                  disabled={notificationPermission === "granted"}
                >
                  <Bell size={15} />
                  {notificationPermission === "granted" ? uiText("通知オン") : uiText("オンにする")}
                </button>
              </div>
            )}
            {!remote && (
              <label className="setting-row">
                <span>{uiText("会話をこの端末に残す")}<small>{uiText("オフにすると、保存済みの会話履歴も削除します。")}</small>
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
                      setNotice(uiText("保存設定を変更できませんでした。"));
                    }
                  }}
                />
              </label>
            )}
            <div className="privacy-note">
              <Shield size={20} />
              <div>
                <h3>{uiText("会話とプライバシー")}</h3>
                <p>{uiText("翻訳する文章は")}{engine === "openrouter"
                    ? uiText("OpenRouterと選択されたAI提供元")
                    : "MyMemory"}{uiText("へ送信されます。音声入力はブラウザの音声認識サービスを利用する場合があります。")}</p>
                <p>{uiText("秘密の部屋はURLを知る人が参加できます。通信は暗号化されますが、エンドツーエンド暗号化ではありません。サーバーには会話履歴を保存しません。フレーズ帳と書き出したファイルは削除するまで残ります。")}</p>
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
                setNotice(uiText("この画面の会話を消去しました。"));
              }}
            >
              <Trash2 size={16} />{uiText("この画面の会話を消去")}</button>
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
                  aria-label={uiText("相手に向けて180度回転")}
                  onClick={() => setFlipped((v) => !v)}
                >
                  <RotateCcw size={20} />
                </button>
                <button
                  className="icon-button"
                  aria-label={uiText("大きな表示を閉じる")}
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
                <Volume2 size={18} />{uiText("ゆっくり読む")}</button>
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
                >{uiText("返事をする · Reply")}<ArrowRight size={18} />
                </button>
              )}
            </div>
          </>
        )}
      </dialog>
    </main>
  );
}
