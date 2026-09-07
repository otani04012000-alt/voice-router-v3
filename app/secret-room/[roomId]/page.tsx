"use client"

import { useParams } from "next/navigation"

/**
 * 秘密の部屋 - ルーム画面（プレースホルダー）
 *
 * 今日の実装範囲はトップページの入室導線まで。
 * 実際のチャット・翻訳UI・リアルタイム同期は次のステップで実装する。
 */
export default function RoomPage() {
  const params = useParams()
  const roomId = params?.roomId as string

  return (
    <main className="room-placeholder">
      <p className="room-placeholder-id">部屋番号: {roomId}</p>
      <p className="room-placeholder-note">
        ここに秘書・コンシェルジュのチャット画面を実装予定です。
      </p>

      <style jsx>{`
        .room-placeholder {
          min-height: 100svh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          background: #14110c;
          color: #f4efe5;
          font-family: "Noto Sans JP", sans-serif;
          text-align: center;
          padding: 2rem;
        }
        .room-placeholder-id {
          font-size: 1.4rem;
          letter-spacing: .08em;
        }
        .room-placeholder-note {
          opacity: .7;
          font-size: .9rem;
        }
      `}</style>
    </main>
  )
}
