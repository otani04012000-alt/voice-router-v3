import type { WebSocket } from "ws"
import type { RoomMember } from "./types.js"

type RoomConnection = {
  socket: WebSocket
  member: RoomMember
}

// roomId -> memberId -> connection
const rooms = new Map<string, Map<string, RoomConnection>>()

export function joinRoom(
  roomId: string,
  member: RoomMember,
  socket: WebSocket,
): RoomMember[] | null {
  let room = rooms.get(roomId)

  if (!room) {
    room = new Map()
    rooms.set(roomId, room)
  }

  if (room.has(member.id)) return null

  const existingMembers = [...room.values()].map((conn) => conn.member)
  room.set(member.id, { socket, member })

  return existingMembers
}

export function leaveRoom(roomId: string, memberId: string): boolean {
  const room = rooms.get(roomId)

  if (!room) {
    return false
  }

  const removed = room.delete(memberId)

  if (room.size === 0) {
    rooms.delete(roomId)
  }

  return removed
}

export function findRoomByMember(
  memberId: string,
): { roomId: string; member: RoomMember } | null {
  for (const [roomId, room] of rooms) {
    const conn = room.get(memberId)

    if (conn) {
      return { roomId, member: conn.member }
    }
  }

  return null
}

export function findRoomIdForSocket(socket: WebSocket): string | null {
  for (const [roomId, room] of rooms) {
    for (const conn of room.values()) {
      if (conn.socket === socket) {
        return roomId
      }
    }
  }

  return null
}

export function findMemberForSocket(
  roomId: string,
  socket: WebSocket,
): RoomMember | null {
  const room = rooms.get(roomId)

  if (!room) {
    return null
  }

  for (const conn of room.values()) {
    if (conn.socket === socket) {
      return conn.member
    }
  }

  return null
}

export function broadcastToRoom(
  roomId: string,
  payload: unknown,
  exceptSocket?: WebSocket,
): void {
  const room = rooms.get(roomId)

  if (!room) {
    return
  }

  const data = JSON.stringify(payload)

  for (const conn of room.values()) {
    if (conn.socket === exceptSocket) {
      continue
    }

    if (conn.socket.readyState === conn.socket.OPEN) {
      conn.socket.send(data)
    }
  }
}

export function roomMemberCount(roomId: string): number {
  return rooms.get(roomId)?.size ?? 0
}

export function totalConnectionCount(): number {
  let total = 0

  for (const room of rooms.values()) {
    total += room.size
  }

  return total
}

export function activeRoomCount(): number {
  return rooms.size
}
