import { createServer } from "node:http"
import { WebSocket, WebSocketServer } from "ws"
import {
  activeRoomCount,
  broadcastToRoom,
  findMemberForSocket,
  findRoomIdForSocket,
  joinRoom,
  leaveRoom,
  totalConnectionCount,
} from "./room-registry.js"
import type { ClientEvent, RoomMember, RoomMessage, ServerEvent, TranslationPayload } from "./types.js"

const PORT = Number(process.env.PORT ?? 3001)

// 原文と検証済みの翻訳ペイロードを中継。履歴は永続化しない。

const MAX_ROOM_ID_LENGTH = 128
const MAX_MEMBER_NAME_LENGTH = 64
const MAX_MESSAGE_BODY_LENGTH = 2000
const MAX_PAYLOAD_BYTES = 32 * 1024

function sendEvent(socket: WebSocket, event: ServerEvent) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(event))
  }
}

function sendError(socket: WebSocket, message: string) {
  sendEvent(socket, { type: "room:error", message })
}

function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength
  )
}

function parseTranslation(value: unknown): TranslationPayload | undefined {
  if (!value || typeof value !== "object") return undefined
  const t = value as TranslationPayload
  const languages = ["ja", "vi", "km", "en"]
  if (!languages.includes(t.source) || !languages.includes(t.target) ||
      !isNonEmptyString(t.original, 600) || !isNonEmptyString(t.translated, 5000) ||
      !["openrouter", "mymemory", "identity"].includes(t.provider) || typeof t.toneApplied !== "boolean") return undefined
  return { source: t.source, target: t.target, original: t.original, translated: t.translated, provider: t.provider, toneApplied: t.toneApplied }
}

function parseClientEvent(raw: string): ClientEvent | null {
  let data: unknown

  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return null
  }

  const event = data as Record<string, unknown>

  if (event.type === "room:join") {
    if (
      isNonEmptyString(event.roomId, MAX_ROOM_ID_LENGTH) &&
      isNonEmptyString(event.memberId, MAX_MEMBER_NAME_LENGTH) &&
      isNonEmptyString(event.memberName, MAX_MEMBER_NAME_LENGTH)
    ) {
      return {
        type: "room:join",
        roomId: event.roomId,
        memberId: event.memberId,
        memberName: event.memberName,
      }
    }

    return null
  }

  if (event.type === "room:message") {
    if (
      isNonEmptyString(event.roomId, MAX_ROOM_ID_LENGTH) &&
      isNonEmptyString(event.clientMessageId, MAX_MEMBER_NAME_LENGTH) &&
      isNonEmptyString(event.body, MAX_MESSAGE_BODY_LENGTH) &&
      typeof event.createdAt === "number" && Number.isFinite(event.createdAt) &&
      (event.translation === undefined || Boolean(parseTranslation(event.translation)) && (event.translation as TranslationPayload).original === event.body)
    ) {
      return {
        type: "room:message",
        roomId: event.roomId,
        clientMessageId: event.clientMessageId,
        body: event.body,
        createdAt: event.createdAt,
        translation: parseTranslation(event.translation),
      }
    }

    return null
  }

  if (event.type === "room:typing") {
    if (
      isNonEmptyString(event.roomId, MAX_ROOM_ID_LENGTH) &&
      typeof event.active === "boolean"
    ) {
      return {
        type: "room:typing",
        roomId: event.roomId,
        active: event.active,
      }
    }

    return null
  }

  return null
}

const httpServer = createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(
      JSON.stringify({
        status: "ok",
        rooms: activeRoomCount(),
        connections: totalConnectionCount(),
      }),
    )
    return
  }

  res.writeHead(404, { "Content-Type": "text/plain" })
  res.end("not found")
})

const wss = new WebSocketServer({ server: httpServer, maxPayload: MAX_PAYLOAD_BYTES })

const alive = new WeakSet<WebSocket>()
const seen = new WeakMap<WebSocket, Set<string>>()
const heartbeat = setInterval(() => {
  for (const socket of wss.clients) {
    if (!alive.has(socket)) { socket.terminate(); continue }
    alive.delete(socket); socket.ping()
  }
}, 30000)
heartbeat.unref()
wss.on("close", () => clearInterval(heartbeat))
wss.on("connection", (socket) => {
  alive.add(socket)
  socket.on("pong", () => alive.add(socket))
  seen.set(socket, new Set())
  let count = 0, windowStart = Date.now()
  const joinTimeout = setTimeout(() => { if (!findRoomIdForSocket(socket)) socket.close(1008, "join required") }, 15000)
  socket.on("close", () => clearTimeout(joinTimeout))
  socket.on("message", (raw) => {
    if (Date.now() - windowStart > 10000) { windowStart = Date.now(); count = 0 }
    if (++count > 150) { socket.close(1008, "rate limit"); return }
    const text = raw.toString()

    if (Buffer.byteLength(text, "utf8") > MAX_PAYLOAD_BYTES) {
      sendError(socket, "メッセージが大きすぎます。")
      return
    }

    const event = parseClientEvent(text)

    if (!event) {
      sendError(socket, "リアルタイム通信の内容を読み取れませんでした。")
      return
    }

    if (event.type === "room:join") {
      handleJoin(socket, event.roomId, event.memberId, event.memberName)
      return
    }

    if (event.type === "room:message") {
      handleMessage(socket, event.roomId, event.clientMessageId, event.body, event.translation)
      return
    }

    if (event.type === "room:typing") {
      handleTyping(socket, event.roomId, event.active)
    }
  })

  socket.on("close", () => {
    handleDisconnect(socket)
  })

  socket.on("error", () => {
    handleDisconnect(socket)
  })
})

function handleJoin(
  socket: WebSocket,
  roomId: string,
  memberId: string,
  memberName: string,
) {
  const existingRoomId = findRoomIdForSocket(socket)

  if (existingRoomId) {
    sendError(socket, "この接続は既に部屋へ参加しています。")
    return
  }

  const member: RoomMember = { id: memberId, name: memberName }
  const existingMembers = joinRoom(roomId, member, socket)
  if (!existingMembers) { sendError(socket, "参加者IDが重複しています。ページを開き直してください。"); socket.close(1008); return }

  sendEvent(socket, {
    type: "room:ready",
    roomId,
    memberId: member.id,
    members: [...existingMembers, member],
  })

  broadcastToRoom(
    roomId,
    {
      type: "room:presence",
      roomId,
      action: "joined",
      member,
      createdAt: Date.now(),
    } satisfies ServerEvent,
    socket,
  )
}

function handleMessage(
  socket: WebSocket,
  roomId: string,
  clientMessageId: string,
  body: string,
  translation?: TranslationPayload,
) {
  const member = findMemberForSocket(roomId, socket)

  if (!member) {
    sendError(socket, "部屋へ参加していないため送信できません。")
    return
  }

  const messageIds = seen.get(socket)!
  if (messageIds.has(clientMessageId)) {
    sendEvent(socket, { type: "room:message", message: { id: clientMessageId, roomId, senderId: member.id, senderName: member.name, body, createdAt: Date.now(), kind: "member", translation } })
    return
  }
  messageIds.add(clientMessageId)
  if (messageIds.size > 1000) messageIds.delete(messageIds.values().next().value!)
  const message: RoomMessage = {
    id: clientMessageId,
    roomId,
    senderId: member.id,
    senderName: member.name,
    body,
    createdAt: Date.now(),
    kind: "member",
    translation,
  }

  broadcastToRoom(
    roomId,
    { type: "room:message", message } satisfies ServerEvent,
  )
}

function handleTyping(socket: WebSocket, roomId: string, active: boolean) {
  const member = findMemberForSocket(roomId, socket)

  if (!member) {
    return
  }

  broadcastToRoom(
    roomId,
    {
      type: "room:typing",
      roomId,
      memberId: member.id,
      memberName: member.name,
      active,
    } satisfies ServerEvent,
    socket,
  )
}

function handleDisconnect(socket: WebSocket) {
  const roomId = findRoomIdForSocket(socket)

  if (!roomId) {
    return
  }

  const member = findMemberForSocket(roomId, socket)

  if (!member) {
    return
  }

  leaveRoom(roomId, member.id)

  broadcastToRoom(roomId, {
    type: "room:presence",
    roomId,
    action: "left",
    member,
    createdAt: Date.now(),
  } satisfies ServerEvent)
}

httpServer.listen(PORT, () => {
  console.log(`secret-room websocket server listening on :${PORT}`)
})
