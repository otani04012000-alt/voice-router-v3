"use client"

import { FormEvent, useState } from "react"

export default function ChatPage() {
  const [draft, setDraft] = useState("")
  const [messages, setMessages] = useState<string[]>([])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    setMessages((current) => [...current, text])
    setDraft("")
  }

  return (
    <main className="chat-page">
      <header className="chat-header">
        <a href="/" className="back-link">入口へ戻る</a>
        <div>
          <p className="eyebrow">通常ルーム</p>
          <h1>いつものチャット</h1>
        </div>
        <span className="status-pill">継続会話</span>
      </header>

      <section className="chat-body" aria-live="polite">
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-mark" aria-hidden="true">◌</div>
            <h2>会話をはじめましょう</h2>
            <p>ここは継続して使う通常ルームです。入力した内容は、この画面で確認できます。</p>
          </div>
        ) : (
          <div className="message-list">
            {messages.map((message, index) => (
              <article className="message-bubble" key={`${message}-${index}`}>
                {message}
              </article>
            ))}
          </div>
        )}
      </section>

      <form className="composer" onSubmit={handleSubmit}>
        <label htmlFor="chat-message" className="sr-only">メッセージ</label>
        <textarea
          id="chat-message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="メッセージを入力"
          rows={2}
        />
        <button type="submit" disabled={!draft.trim()}>送信</button>
      </form>

      <style jsx>{`
        .chat-page {
          min-height: 100svh;
          display: flex;
          flex-direction: column;
          background: #f4efe5;
          color: #211b15;
          font-family: "Noto Sans JP", "Hiragino Sans", sans-serif;
        }
        .chat-header {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 1rem;
          padding: 1.2rem clamp(1rem, 4vw, 3rem);
          border-bottom: 1px solid rgba(57, 43, 28, .14);
          background: rgba(255, 252, 246, .82);
        }
        .back-link { color: #76562e; text-decoration: none; font-size: .85rem; }
        .eyebrow { margin: 0 0 .25rem; color: #9a7543; font-size: .7rem; letter-spacing: .12em; text-align: center; }
        h1 { margin: 0; font-size: 1.15rem; font-weight: 600; text-align: center; }
        .status-pill { justify-self: end; border: 1px solid rgba(127, 93, 48, .28); border-radius: 999px; color: #76562e; padding: .45rem .75rem; font-size: .75rem; }
        .chat-body { flex: 1; width: min(720px, calc(100% - 2rem)); margin: 0 auto; padding: 2rem 0; }
        .empty-state { min-height: 42vh; display: grid; place-content: center; text-align: center; }
        .empty-mark { color: #9a7543; font-size: 3rem; line-height: 1; }
        h2 { margin: 1rem 0 .5rem; font-size: 1.35rem; font-weight: 500; }
        .empty-state p { max-width: 30rem; margin: 0; color: #756b5f; line-height: 1.8; font-size: .9rem; }
        .message-list { display: flex; flex-direction: column; gap: .75rem; }
        .message-bubble { align-self: flex-end; max-width: 80%; padding: .8rem 1rem; border-radius: 1.2rem 1.2rem .25rem 1.2rem; background: #76562e; color: #fffaf0; line-height: 1.6; white-space: pre-wrap; }
        .composer { display: flex; gap: .7rem; width: min(720px, calc(100% - 2rem)); margin: auto auto 1.5rem; padding: .7rem; border: 1px solid rgba(57, 43, 28, .18); border-radius: 1.2rem; background: rgba(255, 252, 246, .9); }
        textarea { flex: 1; resize: vertical; min-height: 3rem; border: 0; outline: 0; background: transparent; color: #211b15; font: inherit; line-height: 1.5; }
        textarea::placeholder { color: #9b9183; }
        button { align-self: end; border: 0; border-radius: 999px; padding: .7rem 1rem; background: #76562e; color: #fffaf0; cursor: pointer; font: inherit; }
        button:disabled { opacity: .45; cursor: not-allowed; }
        .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
        @media (max-width: 600px) {
          .chat-header { grid-template-columns: auto 1fr auto; gap: .6rem; }
          .back-link { font-size: .75rem; }
          h1 { font-size: 1rem; }
          .status-pill { font-size: .68rem; padding: .38rem .55rem; }
        }
      `}</style>
    </main>
  )
}
