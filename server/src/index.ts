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
import type { ClientEvent, RoomMember, RoomMessage, ServerEvent } from "./types.js"

const PORT = Number(process.env.PORT ?? 3001)

// 秘密の部屋の初回段階では、人格・音声・AI返信・翻訳APIを扱わない。
// room:join / room:message / room:typing の中継と、
// room:ready / room:message / room:presence / room:typing / room:error の配信だけを行う。

const MAX_ROOM_ID_LENGTH = 128
const MAX_MEMBER_NAME_LENGTH = 64
const MAX_MESSAGE_BODY_LENGTH = 2000
const MAX_PAYLOAD_BYTES = 8 * 1024

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
      typeof event.createdAt === "number"
    ) {
      return {
        type: "room:message",
        roomId: event.roomId,
        clientMessageId: event.clientMessageId,
        body: event.body,
        createdAt: event.createdAt,
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

const wss = new WebSocketServer({ server: httpServer })

wss.on("connection", (socket) => {
  socket.on("message", (raw) => {
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
      handleMessage(socket, event.roomId, event.clientMessageId, event.body, event.createdAt)
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
  createdAt: number,
) {
  const member = findMemberForSocket(roomId, socket)

  if (!member) {
    sendError(socket, "部屋へ参加していないため送信できません。")
    return
  }

  const message: RoomMessage = {
    id: clientMessageId,
    roomId,
    senderId: member.id,
    senderName: member.name,
    body,
    createdAt,
    kind: "member",
  }

  broadcastToRoom(
    roomId,
    { type: "room:message", message } satisfies ServerEvent,
    socket,
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
