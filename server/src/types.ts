// フロント側 app/secret-room/[roomId]/types.ts と同一の通信契約。
// 人格・音声・AI・翻訳はこのRailwayサーバーの責務に含めない。

export type RoomMessageKind = "member" | "system"

export type RoomMessage = {
  id: string
  roomId: string
  senderId: string
  senderName: string
  body: string
  createdAt: number
  kind: RoomMessageKind
}

export type RoomMember = {
  id: string
  name: string
}

export type ClientEvent =
  | {
      type: "room:join"
      roomId: string
      memberId: string
      memberName: string
    }
  | {
      type: "room:message"
      roomId: string
      clientMessageId: string
      body: string
      createdAt: number
    }
  | {
      type: "room:typing"
      roomId: string
      active: boolean
    }

export type ServerEvent =
  | {
      type: "room:ready"
      roomId: string
      memberId: string
      members: RoomMember[]
    }
  | {
      type: "room:message"
      message: RoomMessage
    }
  | {
      type: "room:presence"
      roomId: string
      action: "joined" | "left"
      member: RoomMember
      createdAt: number
    }
  | {
      type: "room:typing"
      roomId: string
      memberId: string
      memberName: string
      active: boolean
    }
  | {
      type: "room:error"
      message: string
    }
