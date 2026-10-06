"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createClient,
  type RealtimeChannel,
  type SupabaseClient,
} from "@supabase/supabase-js";
import type {
  ConnectionState,
  RoomMember,
  RoomMessage,
  ServerEvent,
  TranslationPayload,
} from "./types";

// 秘密の部屋のリアルタイム同期。旧Railway常駐WebSocketサーバーの役割
// （入室・在室表示・入力中・メッセージ中継）を Supabase Realtime の
// Broadcast / Presence で置き換える。履歴は保存しない。

type Options = {
  enabled?: boolean;
  roomId: string;
  memberId: string;
  memberName: string;
  onMessage: (message: RoomMessage) => void;
  onPresence: (event: Extract<ServerEvent, { type: "room:presence" }>) => void;
  onTyping: (event: Extract<ServerEvent, { type: "room:typing" }>) => void;
  onError: (message: string) => void;
};

const MAX_ROOM_ID_LENGTH = 128;
const MAX_NAME_LENGTH = 64;
const MAX_BODY_LENGTH = 2000;
const LANGUAGES = ["ja", "vi", "km", "zh", "en"];
const PROVIDERS = ["openrouter", "mymemory", "identity"];
const RATE_WINDOW_MS = 10000;
const RATE_LIMIT = 150;

let client: SupabaseClient | null = null;
function getClient() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  return client;
}

const isText = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;

function parseTranslation(value: unknown): TranslationPayload | undefined {
  if (!value || typeof value !== "object") return undefined;
  const t = value as TranslationPayload;
  if (
    !LANGUAGES.includes(t.source) ||
    !LANGUAGES.includes(t.target) ||
    !isText(t.original, 600) ||
    !isText(t.translated, 5000) ||
    !PROVIDERS.includes(t.provider) ||
    typeof t.toneApplied !== "boolean"
  )
    return undefined;
  return {
    original: t.original,
    translated: t.translated,
    source: t.source,
    target: t.target,
    provider: t.provider,
    toneApplied: t.toneApplied,
  };
}

type PresenceMeta = { id?: unknown; name?: unknown; joinedAt?: unknown };
const toMember = (meta: PresenceMeta | undefined): RoomMember | null =>
  meta && isText(meta.id, MAX_NAME_LENGTH) && isText(meta.name, MAX_NAME_LENGTH)
    ? { id: meta.id, name: meta.name }
    : null;

export function useRoomSocket(options: Options) {
  const { enabled = true, roomId, memberId, memberName } = options;
  const callbacks = useRef(options);
  useEffect(() => {
    callbacks.current = options;
  });
  const channelRef = useRef<RealtimeChannel | null>(null);
  const readyRef = useRef(false);
  const memberRef = useRef<RoomMember>({ id: memberId, name: memberName });
  const seenRef = useRef(new Set<string>());
  const rateRef = useRef({ start: 0, count: 0 });
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const [members, setMembers] = useState<RoomMember[]>([]);

  const allow = () => {
    const now = Date.now();
    const rate = rateRef.current;
    if (now - rate.start > RATE_WINDOW_MS) {
      rate.start = now;
      rate.count = 0;
    }
    return ++rate.count <= RATE_LIMIT;
  };

  const sendMessage = useCallback(
    (
      body: string,
      clientMessageId: string,
      createdAt: number,
      translation?: TranslationPayload,
    ) => {
      const channel = channelRef.current;
      if (!readyRef.current || !channel) return false;
      if (
        !isText(body, MAX_BODY_LENGTH) ||
        !isText(clientMessageId, MAX_NAME_LENGTH) ||
        !Number.isFinite(createdAt)
      )
        return false;
      const checked = translation ? parseTranslation(translation) : undefined;
      if (translation && (!checked || checked.original !== body)) return false;
      if (!allow()) {
        callbacks.current.onError("送信が多すぎます。少し待ってお試しください。");
        return false;
      }
      const sender = memberRef.current;
      const message: RoomMessage = {
        id: clientMessageId,
        roomId,
        senderId: sender.id,
        senderName: sender.name,
        body,
        createdAt: Date.now(),
        kind: "member",
        ...(checked ? { translation: checked } : {}),
      };
      void channel
        .send({ type: "broadcast", event: "message", payload: message })
        .then((status) => {
          if (status !== "ok")
            callbacks.current.onError(
              "メッセージを届けられませんでした。もう一度お試しください。",
            );
        });
      return true;
    },
    [roomId],
  );

  const sendTyping = useCallback(
    (active: boolean) => {
      const channel = channelRef.current;
      if (!readyRef.current || !channel || !allow()) return false;
      const sender = memberRef.current;
      void channel.send({
        type: "broadcast",
        event: "typing",
        payload: {
          roomId,
          memberId: sender.id,
          memberName: sender.name,
          active,
        },
      });
      return true;
    },
    [roomId],
  );

  useEffect(() => {
    if (!enabled) return;
    memberRef.current = { id: memberId, name: memberName };
    if (
      !isText(roomId, MAX_ROOM_ID_LENGTH) ||
      !isText(memberId, MAX_NAME_LENGTH) ||
      !isText(memberName, MAX_NAME_LENGTH)
    ) {
      setConnectionState("error");
      callbacks.current.onError("部屋の情報が正しくありません。");
      return;
    }
    const supabase = getClient();
    if (!supabase) {
      setConnectionState("error");
      callbacks.current.onError("部屋への接続設定が見つかりません。");
      return;
    }
    let disposed = false;
    setConnectionState("connecting");
    readyRef.current = false;

    const channel = supabase.channel(`secret-room:${roomId}`, {
      config: {
        broadcast: { self: true, ack: true },
        presence: { key: memberId },
      },
    });
    channelRef.current = channel;

    const currentMembers = () => {
      const state = channel.presenceState<PresenceMeta>();
      const list: RoomMember[] = [];
      for (const metas of Object.values(state)) {
        const member = toMember(metas[0]);
        if (member && !list.some((m) => m.id === member.id)) list.push(member);
      }
      return list;
    };

    channel
      .on("presence", { event: "sync" }, () => {
        if (disposed) return;
        setMembers(currentMembers());
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        if (disposed || key === memberId) return;
        const member = toMember(newPresences[0] as PresenceMeta);
        if (!member) return;
        // 既に在室中の相手が再同期で届いた場合は通知しない
        const state = channel.presenceState<PresenceMeta>();
        if ((state[key]?.length ?? 0) > newPresences.length) return;
        callbacks.current.onPresence({
          type: "room:presence",
          roomId,
          action: "joined",
          member,
          createdAt: Date.now(),
        });
      })
      .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
        if (disposed || key === memberId) return;
        const member = toMember(leftPresences[0] as PresenceMeta);
        if (!member) return;
        // 同じ参加者の別接続が残っている間は退室扱いにしない
        if ((channel.presenceState()[key]?.length ?? 0) > 0) return;
        callbacks.current.onPresence({
          type: "room:presence",
          roomId,
          action: "left",
          member,
          createdAt: Date.now(),
        });
      })
      .on("broadcast", { event: "message" }, ({ payload }) => {
        if (disposed) return;
        const m = payload as Partial<RoomMessage> | undefined;
        if (
          !m ||
          m.roomId !== roomId ||
          !isText(m.id, MAX_NAME_LENGTH) ||
          !isText(m.senderId, MAX_NAME_LENGTH) ||
          !isText(m.senderName, MAX_NAME_LENGTH) ||
          !isText(m.body, MAX_BODY_LENGTH)
        )
          return;
        const translation =
          m.translation === undefined ? undefined : parseTranslation(m.translation);
        if (m.translation !== undefined && (!translation || translation.original !== m.body))
          return;
        const dedupeKey = `${m.senderId}:${m.id}`;
        const seen = seenRef.current;
        if (seen.has(dedupeKey) && m.senderId !== memberId) return;
        seen.add(dedupeKey);
        if (seen.size > 1000) seen.delete(seen.values().next().value!);
        callbacks.current.onMessage({
          id: m.id,
          roomId,
          senderId: m.senderId,
          senderName: m.senderName,
          body: m.body,
          createdAt: Number.isFinite(m.createdAt) ? Number(m.createdAt) : Date.now(),
          kind: "member",
          ...(translation ? { translation } : {}),
        });
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (disposed) return;
        const t = payload as
          | { roomId?: unknown; memberId?: unknown; memberName?: unknown; active?: unknown }
          | undefined;
        if (
          !t ||
          t.roomId !== roomId ||
          t.memberId === memberId ||
          !isText(t.memberId, MAX_NAME_LENGTH) ||
          !isText(t.memberName, MAX_NAME_LENGTH) ||
          typeof t.active !== "boolean"
        )
          return;
        callbacks.current.onTyping({
          type: "room:typing",
          roomId,
          memberId: t.memberId,
          memberName: t.memberName,
          active: t.active,
        });
      })
      .subscribe(async (status) => {
        if (disposed) return;
        if (status === "SUBSCRIBED") {
          const result = await channel.track({
            id: memberId,
            name: memberName,
            joinedAt: Date.now(),
          });
          if (disposed) return;
          if (result !== "ok") {
            setConnectionState("error");
            callbacks.current.onError("部屋への入室を確認できませんでした。");
            return;
          }
          readyRef.current = true;
          setConnectionState("connected");
          const list = currentMembers();
          if (!list.some((m) => m.id === memberId))
            list.push({ id: memberId, name: memberName });
          setMembers(list);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          // supabase-js が自動で再接続する。その間は送信を止める。
          readyRef.current = false;
          setConnectionState("error");
        } else if (status === "CLOSED") {
          readyRef.current = false;
          setMembers([]);
          setConnectionState("disconnected");
        }
      });

    return () => {
      disposed = true;
      readyRef.current = false;
      channelRef.current = null;
      void channel.untrack().finally(() => supabase.removeChannel(channel));
    };
  }, [enabled, roomId, memberId, memberName]);

  return { connectionState, members, sendMessage, sendTyping };
}
