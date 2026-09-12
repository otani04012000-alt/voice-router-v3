"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ClientEvent,
  ConnectionState,
  RoomMember,
  RoomMessage,
  ServerEvent,
  TranslationPayload,
} from "./types";
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
export function useRoomSocket(options: Options) {
  const { enabled = true, roomId, memberId, memberName } = options;
  const callbacks = useRef(options);
  useEffect(() => {
    callbacks.current = options;
  });
  const socketRef = useRef<WebSocket | null>(null);
  const readyRef = useRef(false);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const [members, setMembers] = useState<RoomMember[]>([]);
  const send = useCallback((event: ClientEvent) => {
    const socket = socketRef.current;
    if (!readyRef.current || socket?.readyState !== WebSocket.OPEN)
      return false;
    try {
      socket.send(JSON.stringify(event));
      return true;
    } catch {
      return false;
    }
  }, []);
  const sendMessage = useCallback(
    (
      body: string,
      clientMessageId: string,
      createdAt: number,
      translation?: TranslationPayload,
    ) =>
      send({
        type: "room:message",
        roomId,
        clientMessageId,
        body,
        createdAt,
        ...(translation
          ? {
              translation: {
                original: translation.original,
                translated: translation.translated,
                source: translation.source,
                target: translation.target,
                provider: translation.provider,
                toneApplied: translation.toneApplied,
              },
            }
          : {}),
      }),
    [roomId, send],
  );
  const sendTyping = useCallback(
    (active: boolean) => send({ type: "room:typing", roomId, active }),
    [roomId, send],
  );
  useEffect(() => {
    if (!enabled) return;
    let disposed = false,
      attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let handshake: ReturnType<typeof setTimeout> | undefined;
    // The existing Railway service for this repository. Override for other deployments.
    const url =
      process.env.NEXT_PUBLIC_SECRET_ROOM_WS_URL?.trim() ||
      "wss://voice-router-v3-production.up.railway.app";
    const connect = () => {
      if (disposed) return;
      setConnectionState("connecting");
      readyRef.current = false;
      let socket: WebSocket;
      try {
        socket = new WebSocket(url);
      } catch {
        setConnectionState("error");
        callbacks.current.onError("部屋への接続を開始できませんでした。");
        return;
      }
      socketRef.current = socket;
      handshake = setTimeout(() => socket.close(), 12000);
      socket.onopen = () => {
        if (disposed || socketRef.current !== socket) {
          socket.close();
          return;
        }
        socket.send(
          JSON.stringify({
            type: "room:join",
            roomId,
            memberId,
            memberName,
          } satisfies ClientEvent),
        );
      };
      socket.onmessage = (raw) => {
        if (disposed || socketRef.current !== socket) return;
        try {
          const e = JSON.parse(raw.data) as ServerEvent;
          if (!e || typeof e !== "object") return;
          if (
            e.type === "room:ready" &&
            e.roomId === roomId &&
            e.memberId === memberId &&
            Array.isArray(e.members)
          ) {
            clearTimeout(handshake);
            readyRef.current = true;
            attempt = 0;
            setConnectionState("connected");
            setMembers(e.members);
          } else if (
            e.type === "room:message" &&
            e.message?.roomId === roomId &&
            typeof e.message.body === "string" &&
            Number.isFinite(e.message.createdAt)
          )
            callbacks.current.onMessage(e.message);
          else if (e.type === "room:presence" && e.roomId === roomId) {
            setMembers((current) =>
              e.action === "joined"
                ? [...current.filter((m) => m.id !== e.member.id), e.member]
                : current.filter((m) => m.id !== e.member.id),
            );
            callbacks.current.onPresence(e);
          } else if (
            e.type === "room:typing" &&
            e.roomId === roomId &&
            e.memberId !== memberId
          )
            callbacks.current.onTyping(e);
          else if (e.type === "room:error")
            callbacks.current.onError(e.message);
        } catch {
          callbacks.current.onError("受信した会話を読み取れませんでした。");
        }
      };
      socket.onerror = () => {
        if (!disposed) setConnectionState("error");
      };
      socket.onclose = () => {
        clearTimeout(handshake);
        if (disposed || socketRef.current !== socket) return;
        readyRef.current = false;
        socketRef.current = null;
        setMembers([]);
        setConnectionState("disconnected");
        timer = setTimeout(connect, Math.min(1000 * 2 ** attempt++, 10000));
      };
    };
    connect();
    return () => {
      disposed = true;
      clearTimeout(timer);
      clearTimeout(handshake);
      readyRef.current = false;
      const socket = socketRef.current;
      socketRef.current = null;
      if (socket) {
        socket.onclose = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.close();
      }
    };
  }, [enabled, roomId, memberId, memberName]);
  return { connectionState, members, sendMessage, sendTyping };
}
