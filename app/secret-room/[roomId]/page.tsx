"use client"

import { FormEvent, useState } from "react"
import { useParams } from "next/navigation"

type TranslationResult = {
  original: string
  translated: string
}

export default function RoomPage() {
  const params = useParams()
  const roomId = params?.roomId as string
  const [text, setText] = useState("")
  const [result, setResult] = useState<TranslationResult | null>(null)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleTranslate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const original = text.trim()
    if (!original || isLoading) return

    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona: "secretary", text: original }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok || !data?.translated) {
        throw new Error("翻訳を取得できませんでした。")
      }

      setResult({ original: data.original, translated: data.translated })
      setText("")
    } catch {
      setError("翻訳に失敗しました。通信状態を確認して、もう一度お試しください。")
    } finally {
      setIsLoading(false)
    }
  }

  const canSubmit = text.trim().length > 0 && !isLoading

  return (
    <main className="secret-room">
      <header className="secret-room-header">
        <a href="/" className="secret-room-back">入口へ戻る</a>
        <div>
          <p className="secret-room-eyebrow">秘密のチャット</p>
          <h1>二人の翻訳ルーム</h1>
        </div>
        <p className="secret-room-id">部屋番号: {roomId}</p>
      </header>

      <section className="secret-room-body" aria-live="polite">
        {result ? (
          <div className="translation-card">
            <p className="translation-label">あなたの言葉</p>
            <p className="translation-original">{result.original}</p>
            <div className="translation-divider" aria-hidden="true">日本語 → ベトナム語</div>
            <p className="translation-label">相手に見せる言葉</p>
            <p className="translation-result">{result.translated}</p>
          </div>
        ) : (
          <div className="translation-empty">
            <span aria-hidden="true" className="translation-mark">◌</span>
            <h2>日本語を入力してください</h2>
            <p>翻訳結果を大きく表示し、相手にそのまま見せられます。</p>
          </div>
        )}
      </section>

      <form className="translation-composer" onSubmit={handleTranslate}>
        <label htmlFor="translation-text" className="sr-only">日本語のメッセージ</label>
        <textarea
          id="translation-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="日本語で話しかけてください"
          rows={3}
          disabled={isLoading}
        />
        {error ? <p className="translation-error" role="alert">{error}</p> : null}
        <button type="submit" disabled={!canSubmit}>
          {isLoading ? "翻訳しています…" : "ベトナム語へ翻訳"}
        </button>
      </form>

      <style jsx>{`
        .secret-room {
          min-height: 100svh;
          display: grid;
          grid-template-rows: auto 1fr auto;
          background: radial-gradient(circle at 50% 0%, rgba(216, 185, 104, 0.12), transparent 32rem), #14110c;
          color: #f4efe5;
          font-family: "Noto Sans JP", "Hiragino Sans", sans-serif;
        }
        .secret-room-header {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          align-items: center;
          gap: 1rem;
          padding: 1.1rem 1.25rem;
          border-bottom: 1px solid rgba(244, 239, 229, 0.12);
        }
        .secret-room-back { color: rgba(244, 239, 229, 0.76); font-size: 0.82rem; text-decoration: none; width: fit-content; }
        .secret-room-back:hover { color: #f4efe5; }
        .secret-room-header div { text-align: center; }
        .secret-room-eyebrow, .secret-room-id { margin: 0; color: rgba(244, 239, 229, 0.62); font-size: 0.72rem; letter-spacing: 0.12em; }
        .secret-room-header h1 { margin: 0.25rem 0 0; font-size: clamp(1.05rem, 4vw, 1.35rem); font-weight: 500; letter-spacing: 0.04em; }
        .secret-room-id { text-align: right; overflow-wrap: anywhere; }
        .secret-room-body { display: grid; place-items: center; width: min(100%, 48rem); margin: 0 auto; padding: 2rem 1.25rem; }
        .translation-card, .translation-empty { width: 100%; box-sizing: border-box; border: 1px solid rgba(244, 239, 229, 0.16); border-radius: 1.5rem; background: rgba(25, 21, 15, 0.72); box-shadow: 0 1.2rem 4rem rgba(0, 0, 0, 0.22); }
        .translation-card { padding: clamp(1.5rem, 6vw, 3rem); }
        .translation-label { margin: 0; color: rgba(244, 239, 229, 0.58); font-size: 0.75rem; letter-spacing: 0.12em; }
        .translation-original { margin: 0.7rem 0 0; font-size: clamp(1.15rem, 4vw, 1.6rem); line-height: 1.65; }
        .translation-divider { display: flex; align-items: center; gap: 0.7rem; margin: 1.6rem 0; color: rgba(216, 185, 104, 0.78); font-size: 0.72rem; letter-spacing: 0.1em; }
        .translation-divider::before, .translation-divider::after { content: ""; flex: 1; height: 1px; background: rgba(216, 185, 104, 0.32); }
        .translation-result { margin: 0.85rem 0 0; color: #fff7e7; font-size: clamp(1.7rem, 7.5vw, 3.5rem); font-weight: 500; line-height: 1.45; word-break: break-word; }
        .translation-empty { max-width: 31rem; padding: 2.4rem 1.5rem; text-align: center; }
        .translation-mark { display: block; color: rgba(216, 185, 104, 0.9); font-size: 2.6rem; line-height: 1; }
        .translation-empty h2 { margin: 1rem 0 0; font-size: 1.15rem; font-weight: 500; }
        .translation-empty p { margin: 0.7rem 0 0; color: rgba(244, 239, 229, 0.64); font-size: 0.9rem; line-height: 1.75; }
        .translation-composer { position: sticky; bottom: 0; padding: 1rem 1.25rem max(1rem, env(safe-area-inset-bottom)); border-top: 1px solid rgba(244, 239, 229, 0.12); background: rgba(20, 17, 12, 0.94); backdrop-filter: blur(1rem); }
        .translation-composer textarea, .translation-composer button { display: block; width: min(100%, 46rem); box-sizing: border-box; margin: 0 auto; font: inherit; }
        .translation-composer textarea { resize: vertical; min-height: 5.5rem; padding: 0.95rem 1rem; border: 1px solid rgba(244, 239, 229, 0.25); border-radius: 1rem; outline: none; background: rgba(244, 239, 229, 0.06); color: #f4efe5; font-size: 1rem; line-height: 1.55; }
        .translation-composer textarea::placeholder { color: rgba(244, 239, 229, 0.45); }
        .translation-composer textarea:focus { border-color: rgba(216, 185, 104, 0.82); box-shadow: 0 0 0 0.2rem rgba(216, 185, 104, 0.12); }
        .translation-composer textarea:disabled { opacity: 0.7; }
        .translation-composer button { margin-top: 0.75rem; padding: 0.9rem 1.2rem; border: 1px solid rgba(216, 185, 104, 0.7); border-radius: 999px; background: rgba(216, 185, 104, 0.18); color: #fff7e7; cursor: pointer; font-size: 1rem; letter-spacing: 0.05em; transition: background 0.2s ease, opacity 0.2s ease; }
        .translation-composer button:hover:not(:disabled) { background: rgba(216, 185, 104, 0.28); }
        .translation-composer button:disabled { cursor: not-allowed; opacity: 0.45; }
        .translation-error { width: min(100%, 46rem); box-sizing: border-box; margin: 0.7rem auto 0; color: #ffb4a6; font-size: 0.85rem; line-height: 1.5; }
        .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
        @media (max-width: 640px) {
          .secret-room-header { grid-template-columns: 1fr auto; }
          .secret-room-header div { grid-column: 1 / -1; grid-row: 1; }
          .secret-room-back { grid-column: 1; grid-row: 2; }
          .secret-room-id { grid-column: 2; grid-row: 2; }
          .secret-room-body { padding-top: 1.5rem; }
          .translation-result { font-size: clamp(1.65rem, 9vw, 2.8rem); }
        }
      `}</style>
    </main>
  )
}
