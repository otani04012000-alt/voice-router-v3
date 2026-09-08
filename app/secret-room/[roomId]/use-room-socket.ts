"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type {
  ClientEvent,
  ConnectionState,
  RoomMember,
  RoomMessage,
  ServerEvent,
} from "./types"

type UseRoomSocketOptions = {
  roomId: string
  memberId: string
  memberName: string
  onMessage: (message: RoomMessage) => void
  onPresence: (event: Extract<ServerEvent, { type: "room:presence" }>) => void
  onTyping: (event: Extract<ServerEvent, { type: "room:typing" }>) => void
  onError: (message: string) => void
}

function websocketUrl() {
  return process.env.NEXT_PUBLIC_SECRET_ROOM_WS_URL?.trim() ?? ""
}

export function useRoomSocket({
  roomId,
  memberId,
  memberName,
  onMessage,
  onPresence,
  onTyping,
  onError,
}: UseRoomSocketOptions) {
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const reconnectAttemptRef = useRef(0)
  const mountedRef = useRef(false)

  const onMessageRef = useRef(onMessage)
  const onPresenceRef = useRef(onPresence)
  const onTypingRef = useRef(onTyping)
  const onErrorRef = useRef(onError)

  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting")
  const [members, setMembers] = useState<RoomMember[]>([])

  useEffect(() => {
    onMessageRef.current = onMessage
    onPresenceRef.current = onPresence
    onTypingRef.current = onTyping
    onErrorRef.current = onError
  }, [onError, onMessage, onPresence, onTyping])

  const send = useCallback((event: ClientEvent) => {
    const socket = socketRef.current

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false
    }

    socket.send(JSON.stringify(event))
    return true
  }, [])

  const sendMessage = useCallback(
    (body: string, clientMessageId: string, createdAt: number) => {
      return send({
        type: "room:message",
        roomId,
        clientMessageId,
        body,
        createdAt,
      })
    },
    [roomId, send],
  )

  const sendTyping = useCallback(
    (active: boolean) => {
      return send({
        type: "room:typing",
        roomId,
        active,
      })
    },
    [roomId, send],
  )

  useEffect(() => {
    mountedRef.current = true

    const url = websocketUrl()

    if (!url) {
      setConnectionState("error")
      onErrorRef.current(
        "リアルタイム接続先が未設定です。NEXT_PUBLIC_SECRET_ROOM_WS_URL を設定してください。",
      )

      return () => {
        mountedRef.current = false
      }
    }

    function clearReconnectTimer() {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
    }

    function scheduleReconnect() {
      clearReconnectTimer()

      if (!mountedRef.current) {
        return
      }

      reconnectAttemptRef.current += 1
      const delay = Math.min(1000 * 2 ** (reconnectAttemptRef.current - 1), 8000)

      reconnectTimerRef.current = window.setTimeout(() => {
        connect()
      }, delay)
    }

    function handleServerEvent(event: ServerEvent) {
      if (event.type === "room:ready") {
        setMembers(event.members)
        return
      }

      if (event.type === "room:message") {
        onMessageRef.current(event.message)
        return
      }

      if (event.type === "room:presence") {
        setMembers((current) => {
          if (event.action === "joined") {
            if (current.some((member) => member.id === event.member.id)) {
              return current
            }

            return [...current, event.member]
          }

          return current.filter((member) => member.id !== event.member.id)
        })

        onPresenceRef.current(event)
        return
      }

      if (event.type === "room:typing") {
        onTypingRef.current(event)
        return
      }

      if (event.type === "room:error") {
        onErrorRef.current(event.message)
      }
    }

    function connect() {
      setConnectionState("connecting")

      const socket = new WebSocket(url)
      socketRef.current = socket

      socket.addEventListener("open", () => {
        if (socketRef.current !== socket) {
          return
        }

        reconnectAttemptRef.current = 0
        setConnectionState("connected")

        socket.send(
          JSON.stringify({
            type: "room:join",
            roomId,
            memberId,
            memberName,
          } satisfies ClientEvent),
        )
      })

      socket.addEventListener("message", (rawEvent) => {
        try {
          const event = JSON.parse(rawEvent.data) as ServerEvent
          handleServerEvent(event)
        } catch {
          onErrorRef.current("リアルタイム通信の内容を読み取れませんでした。")
        }
      })

      socket.addEventListener("error", () => {
        if (socketRef.current === socket) {
          setConnectionState("error")
        }
      })

      socket.addEventListener("close", () => {
        if (socketRef.current !== socket) {
          return
        }

        socketRef.current = null

        if (!mountedRef.current) {
          return
        }

        setConnectionState("disconnected")
        scheduleReconnect()
      })
    }

    connect()

    return () => {
      mountedRef.current = false
      clearReconnectTimer()

      const socket = socketRef.current
      socketRef.current = null

      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close()
      }
    }
  }, [memberId, memberName, roomId])

  return {
    connectionState,
    members,
    sendMessage,
    sendTyping,
  }
}
