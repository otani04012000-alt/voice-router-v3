"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "next/navigation"
import "./secret-room.css"
import { useRoomSocket } from "./use-room-socket"
import type { ConnectionState, RoomMessage } from "./types"

type Persona = "secretary" | "concierge"

function createMemberId() {
  return `member-${crypto.randomUUID()}`
}

function createMessageId() {
  return `message-${crypto.randomUUID()}`
}

function formatTime(createdAt: number) {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(createdAt))
}

function connectionLabel(connectionState: ConnectionState) {
  if (connectionState === "connected") {
    return "接続中"
  }

  if (connectionState === "connecting") {
    return "接続準備中"
  }

  if (connectionState === "disconnected") {
    return "再接続中"
  }

  return "接続エラー"
}

export default function SecretRoomPage() {
  const params = useParams()
  const roomId = decodeURIComponent((params?.roomId as string) ?? "")

  const [memberId] = useState(createMemberId)
  const [memberName] = useState(() => `来訪者-${createMemberId().slice(-4)}`)
  const [persona, setPersona] = useState<Persona>("secretary")
  const [messageText, setMessageText] = useState("")
  const [messages, setMessages] = useState<RoomMessage[]>([])
  const [typingMembers, setTypingMembers] = useState<
    Array<{ id: string; name: string }>
  >([])
  const [notice, setNotice] = useState("")
  const [localTyping, setLocalTyping] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const typingStopTimerRef = useRef<number | null>(null)

  const appendMessage = useCallback((message: RoomMessage) => {
    setMessages((current) => {
      if (current.some((item) => item.id === message.id)) {
        return current
      }

      return [...current, message]
    })
  }, [])

  const handleMessage = useCallback(
    (message: RoomMessage) => {
      if (message.senderId === memberId) {
        return
      }

      appendMessage(message)
    },
    [appendMessage, memberId],
  )

  const handlePresence = useCallback(
    ({
      action,
      member,
      createdAt,
    }: {
      action: "joined" | "left"
      member: { id: string; name: string }
      createdAt: number
    }) => {
      if (member.id === memberId) {
        return
      }

      appendMessage({
        id: `presence-${action}-${member.id}-${createdAt}`,
        roomId,
        senderId: member.id,
        senderName: "秘密の部屋",
        body:
          action === "joined"
            ? `${member.name}が入室しました。`
            : `${member.name}が退室しました。`,
        createdAt,
        kind: "system",
      })
    },
    [appendMessage, memberId, roomId],
  )

  const handleTyping = useCallback(
    ({
      memberId: typingMemberId,
      memberName: typingMemberName,
      active,
    }: {
      memberId: string
      memberName: string
      active: boolean
    }) => {
      if (typingMemberId === memberId) {
        return
      }

      setTypingMembers((current) => {
        const withoutMember = current.filter(
          (member) => member.id !== typingMemberId,
        )

        if (!active) {
          return withoutMember
        }

        return [
          ...withoutMember,
          {
            id: typingMemberId,
            name: typingMemberName,
          },
        ]
      })
    },
    [memberId],
  )

  const {
    connectionState,
    members,
    sendMessage,
    sendTyping,
  } = useRoomSocket({
    roomId,
    memberId,
    memberName,
    onMessage: handleMessage,
    onPresence: handlePresence,
    onTyping: handleTyping,
    onError: setNotice,
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    })
  }, [messages, typingMembers])

  useEffect(() => {
    return () => {
      if (typingStopTimerRef.current !== null) {
        window.clearTimeout(typingStopTimerRef.current)
      }
    }
  }, [])

  const typingLabel = useMemo(() => {
    if (typingMembers.length === 0) {
      return ""
    }

    if (typingMembers.length === 1) {
      return `${typingMembers[0].name}が入力中`
    }

    return `${typingMembers.length}人が入力中`
  }, [typingMembers])

  const handleCopyRoomUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setNotice("この部屋のURLをコピーしました。")
    } catch {
      setNotice("URLをコピーできませんでした。ブラウザのアドレス欄から共有してください。")
    }
  }, [])

  const stopTyping = useCallback(() => {
    if (!localTyping) {
      return
    }

    setLocalTyping(false)
    sendTyping(false)
  }, [localTyping, sendTyping])

  const handleMessageChange = useCallback(
    (nextText: string) => {
      setMessageText(nextText)

      if (!nextText.trim()) {
        if (typingStopTimerRef.current !== null) {
          window.clearTimeout(typingStopTimerRef.current)
          typingStopTimerRef.current = null
        }

        stopTyping()
        return
      }

      if (!localTyping) {
        setLocalTyping(true)
        sendTyping(true)
      }

      if (typingStopTimerRef.current !== null) {
        window.clearTimeout(typingStopTimerRef.current)
      }

      typingStopTimerRef.current = window.setTimeout(() => {
        stopTyping()
      }, 900)
    },
    [localTyping, sendTyping, stopTyping],
  )

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      const body = messageText.trim()

      if (!body) {
        return
      }

      const createdAt = Date.now()
      const clientMessageId = createMessageId()

      appendMessage({
        id: clientMessageId,
        roomId,
        senderId: memberId,
        senderName: memberName,
        body,
        createdAt,
        kind: "member",
      })

      const sent = sendMessage(body, clientMessageId, createdAt)

      if (!sent) {
        setNotice("接続が完了していないため、送信できませんでした。")
      }

      setMessageText("")

      if (typingStopTimerRef.current !== null) {
        window.clearTimeout(typingStopTimerRef.current)
        typingStopTimerRef.current = null
      }

      stopTyping()
    },
    [
      appendMessage,
      memberId,
      memberName,
      messageText,
      roomId,
      sendMessage,
      stopTyping,
    ],
  )

  return (
    <main className="secret-room">
      <section className="secret-room__shell">
        <header className="secret-room__header">
          <div>
            <p className="secret-room__kicker">秘密の部屋</p>
            <h1>静かな会話のための部屋</h1>
          </div>

          <div className="secret-room__header-actions">
            <span
              className={`secret-room__connection secret-room__connection--${connectionState}`}
            >
              {connectionLabel(connectionState)}
            </span>
            <button
              className="secret-room__share-button"
              type="button"
              onClick={handleCopyRoomUrl}
            >
              この部屋を共有
            </button>
          </div>
        </header>

        <section className="secret-room__meta" aria-label="部屋の情報">
          <p className="secret-room__room-id">
            ルームID：<strong>{roomId}</strong>
          </p>

          <p className="secret-room__presence">
            在室：{members.length}人
          </p>

          <div className="secret-room__persona" aria-label="人格の選択">
            <button
              className={
                persona === "secretary"
                  ? "secret-room__persona-button is-active"
                  : "secret-room__persona-button"
              }
              type="button"
              onClick={() => setPersona("secretary")}
            >
              秘書
            </button>
            <button
              className={
                persona === "concierge"
                  ? "secret-room__persona-button is-active"
                  : "secret-room__persona-button"
              }
              type="button"
              onClick={() => setPersona("concierge")}
            >
              コンシェルジュ
            </button>
          </div>
        </section>

        {notice ? (
          <div className="secret-room__notice" role="status">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice("")}>
              閉じる
            </button>
          </div>
        ) : null}

        <section className="secret-room__messages" aria-live="polite">
          {messages.length === 0 ? (
            <article className="secret-room__message secret-room__message--system">
              <p className="secret-room__message-name">秘密の部屋</p>
              <p className="secret-room__message-body">
                このURLを共有すると、同じ部屋で話せます。
              </p>
            </article>
          ) : null}

          {messages.map((message) => {
            const isSelf = message.senderId === memberId

            return (
              <article
                className={[
                  "secret-room__message",
                  message.kind === "system"
                    ? "secret-room__message--system"
                    : "",
                  isSelf ? "secret-room__message--self" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={message.id}
              >
                <p className="secret-room__message-name">
                  {isSelf ? "あなた" : message.senderName}
                </p>
                <p className="secret-room__message-body">{message.body}</p>
                <time
                  className="secret-room__message-time"
                  dateTime={new Date(message.createdAt).toISOString()}
                >
                  {formatTime(message.createdAt)}
                </time>
              </article>
            )
          })}

          <div ref={messagesEndRef} />
        </section>

        {typingLabel ? (
          <p className="secret-room__typing" aria-live="polite">
            {typingLabel}
            <span aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </p>
        ) : null}

        <form className="secret-room__composer" onSubmit={handleSubmit}>
          <label className="secret-room__sr-only" htmlFor="secret-room-message">
            メッセージ
          </label>
          <textarea
            id="secret-room-message"
            value={messageText}
            onChange={(event) => handleMessageChange(event.target.value)}
            onBlur={stopTyping}
            maxLength={2000}
            placeholder="ここに話しかける"
            rows={1}
          />
          <button
            type="submit"
            disabled={connectionState !== "connected" || !messageText.trim()}
          >
            送る
          </button>
        </form>

        <p className="secret-room__note">
          現在の人格表示は画面内だけの切替です。AI返信と読み上げは次の段階で追加します。
        </p>
      </section>
    </main>
  )
}
