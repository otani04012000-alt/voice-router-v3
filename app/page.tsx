"use client"

/**
 * 専属オープンコンシェルジュサポート室の入口ページ。
 *
 * 継続して使う通常チャットと、その場限りの秘密チャットを二択で案内する。
 * 背景の神社・霞・ハロー演出は既存の世界観を引き継ぐ。
 */

function generateRoomId() {
  return Math.random().toString(36).slice(2, 8)
}

export default function Page() {
  const handleStartStandard = () => {
    window.location.href = "/chat"
  }

  const handleStartSecret = () => {
    const roomId = generateRoomId()
    window.location.href = `/secret-room/${roomId}`
  }

  return (
    <main className="room-hero">
      <div className="room-hero-img" aria-hidden="true" />
      <div className="room-hero-overlay" aria-hidden="true" />
      <div className="room-hero-cloud" aria-hidden="true" />
      <div className="halo" aria-hidden="true" />
      <div className="kasumi" aria-hidden="true">
        <i className="k1" />
        <i className="k2" />
        <i className="k3" />
      </div>

      <div className="room-content">
        <div className="room-welcome">
          <h1>２人の専属オープンコンシェルジュサポート室</h1>
        </div>

        <div className="room-actions">
          <button type="button" className="room-btn room-btn-primary" onClick={handleStartStandard}>
            いつものチャットを開始
          </button>
          <button type="button" className="room-btn room-btn-secondary" onClick={handleStartSecret}>
            秘密のチャットで開始
          </button>
        </div>
      </div>

      <style jsx global>{`
        html, body { margin: 0; padding: 0; background: #0e0b08; }
      `}</style>

      <style jsx>{`
        .room-hero {
          position: relative;
          min-height: 100svh;
          overflow: hidden;
          display: grid;
          place-items: center;
          font-family: "Noto Sans JP", "Hiragino Sans", sans-serif;
        }
        .room-hero-img {
          position: absolute;
          inset: 0;
          background-image: url('/secret-room/hero-shrine.jpg');
          background-size: cover;
          background-position: center;
          transform: scale(1.08);
        }
        .room-hero-overlay {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(130% 90% at 50% 24%, transparent 34%, rgba(20,17,12,.32) 74%, rgba(20,17,12,.66) 100%),
            linear-gradient(180deg, rgba(20,17,12,.42) 0%, transparent 26%, transparent 52%, rgba(20,17,12,.78) 100%);
        }
        .room-hero-cloud {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 38%;
          pointer-events: none;
          opacity: 0;
        }
        .kasumi {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 22%;
          pointer-events: none;
          overflow: hidden;
          isolation: isolate;
          -webkit-mask-image: linear-gradient(to bottom, #000 0%, rgba(0,0,0,.8) 42%, transparent 100%);
          mask-image: linear-gradient(to bottom, #000 0%, rgba(0,0,0,.8) 42%, transparent 100%);
        }
        .kasumi i {
          position: absolute;
          top: -10%; left: -40%;
          width: 180%; height: 120%;
          display: block;
          will-change: transform;
          backface-visibility: hidden;
        }
        .kasumi .k1 {
          background: linear-gradient(90deg, transparent 0%, rgba(150,168,190,.11) 20%, rgba(172,188,206,.16) 46%, rgba(146,164,188,.10) 70%, transparent 100%);
          filter: blur(62px); opacity: .55;
          animation: kasumi-a 46s linear infinite;
        }
        .kasumi .k2 {
          background:
            radial-gradient(120% 62% at 32% 42%, rgba(178,194,210,.13), transparent 72%),
            radial-gradient(92% 54% at 76% 32%, rgba(146,166,190,.10), transparent 74%);
          filter: blur(76px); opacity: .45;
          animation: kasumi-b 61s linear infinite;
        }
        .kasumi .k3 {
          background: linear-gradient(100deg, transparent 12%, rgba(206,218,230,.09) 50%, transparent 88%);
          filter: blur(48px); opacity: .28;
          animation: kasumi-a 37s linear infinite reverse;
        }
        @keyframes kasumi-a {
          from { transform: translate3d(-8%,0,0); }
          to { transform: translate3d(8%,0,0); }
        }
        @keyframes kasumi-b {
          0% { transform: translate3d(6%,0,0) scaleY(1); }
          50% { transform: translate3d(-6%,0,0) scaleY(1.06); }
          100% { transform: translate3d(6%,0,0) scaleY(1); }
        }
        .halo {
          position: absolute;
          pointer-events: none;
          border-radius: 50%;
          left: 50%; top: 46%;
          width: 46vmin; height: 46vmin;
          max-width: 620px; max-height: 620px;
          transform: translate(-50%,-50%);
          background: radial-gradient(circle at 50% 50%, rgba(255,206,130,.19) 0%, rgba(255,184,94,.10) 33%, rgba(228,158,68,.042) 56%, transparent 72%);
          filter: blur(36px);
          mix-blend-mode: screen;
          opacity: .6;
          animation: halo-breathe 9.2s ease-in-out infinite;
        }
        @keyframes halo-breathe {
          0%, 100% { opacity: .50; transform: translate(-50%,-50%) scale(1); }
          50% { opacity: .76; transform: translate(-50%,-50%) scale(1.045); }
        }
        @media (max-width: 600px) {
          .kasumi { height: 25%; }
          .kasumi .k1 { filter: blur(42px); }
          .kasumi .k2 { filter: blur(50px); }
          .kasumi .k3 { filter: blur(34px); }
          .halo { width: 64vmin; filter: blur(26px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .kasumi i, .halo { animation: none !important; }
          .halo { opacity: .58; transform: translate(-50%,-50%) scale(1.02); }
        }

        .room-content {
          position: relative;
          z-index: 3;
          text-align: center;
          color: #f4efe5;
          padding: 2rem 1.5rem;
          max-width: 720px;
        }
        .room-welcome {
          display: flex;
          flex-direction: column;
          gap: 0.9rem;
          margin-bottom: 2.5rem;
        }
        .room-welcome h1 {
          margin: 0;
          max-width: 34rem;
          text-shadow: 0 2px 20px rgba(0,0,0,.7);
          font-size: clamp(1.25rem, 3.8vw, 2rem);
          font-weight: 500;
          line-height: 1.6;
          letter-spacing: .04em;
        }

        .room-actions {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.2rem;
        }
        .room-btn {
          font-family: inherit;
          font-size: 1rem;
          letter-spacing: .06em;
          padding: 0.9rem 2.2rem;
          border-radius: 999px;
          border: 1px solid rgba(244,239,229,.5);
          background: rgba(20,17,12,.35);
          color: #f4efe5;
          cursor: pointer;
          transition: background .25s ease, border-color .25s ease;
        }
        .room-btn:hover {
          background: rgba(216,185,104,.18);
          border-color: rgba(216,185,104,.6);
        }
        .room-btn-primary {
          font-weight: 500;
          background: rgba(216,185,104,.18);
          border-color: rgba(216,185,104,.62);
        }
        .room-btn-secondary {
          padding: 0.75rem 1.7rem;
          font-size: .9rem;
        }
      `}</style>
    </main>
  )
}
