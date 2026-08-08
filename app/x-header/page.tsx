"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"

const W = 1500
const H = 500
const X = 420
const GOLD = "#c8a96e"
const GOLD_BRIGHT = "#dcb974"
const INK_WHITE = "#efe9dd"

const MINCHO = '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", serif'
const SANS = '"Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", sans-serif'

type Line = {
  text: string
  y: number
  size: number
  tracking: number
  color: string
  weight: number
  mincho: boolean
}

const LINES: Line[] = [
  { text: "OTANI KIKAKU", y: 118, size: 22, tracking: 0.5, color: GOLD, weight: 400, mincho: false },
  { text: "動く景色を、仕立てる。", y: 190, size: 52, tracking: 0.02, color: INK_WHITE, weight: 500, mincho: true },
  { text: "WebGL / GLSL 演出 OEM", y: 272, size: 21, tracking: 0.08, color: "#cfc8b8", weight: 400, mincho: false },
  { text: "LP制作会社・Web制作者向け", y: 304, size: 18, tracking: 0.06, color: "rgba(207,200,184,0.72)", weight: 400, mincho: false },
  { text: "初回1案件 29,800円｜ご相談はDM", y: 360, size: 23, tracking: 0.06, color: GOLD_BRIGHT, weight: 500, mincho: true },
]

function drawTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  tracking: number,
) {
  const gap = size * tracking
  let cx = x
  for (const ch of Array.from(text)) {
    ctx.fillText(ch, cx, y)
    cx += ctx.measureText(ch).width + gap
  }
}

export default function XHeaderPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [ready, setReady] = useState(false)

  const render = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    try {
      await Promise.all([
        document.fonts.load('500 52px "Shippori Mincho"', "動く景色を、仕立てる。"),
        document.fonts.load('400 23px "Shippori Mincho"', "初回案件円ご相談は"),
      ])
      await document.fonts.ready
    } catch {}

    const img = new Image()
    img.src = "/shinden.webp"
    await new Promise<void>((resolve) => {
      img.onload = () => resolve()
      img.onerror = () => resolve()
    })

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = "#05070a"
    ctx.fillRect(0, 0, W, H)

    if (img.naturalWidth > 0) {
      const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight)
      const dw = img.naturalWidth * scale
      const dh = img.naturalHeight * scale
      ctx.drawImage(img, W - dw * 0.62, (H - dh) / 2, dw, dh)
    }

    const veil = ctx.createLinearGradient(0, 0, W, 0)
    veil.addColorStop(0, "rgba(4,6,9,0.97)")
    veil.addColorStop(0.52, "rgba(4,6,9,0.88)")
    veil.addColorStop(0.78, "rgba(4,6,9,0.45)")
    veil.addColorStop(1, "rgba(4,6,9,0.62)")
    ctx.fillStyle = veil
    ctx.fillRect(0, 0, W, H)

    const vert = ctx.createLinearGradient(0, 0, 0, H)
    vert.addColorStop(0, "rgba(3,5,8,0.75)")
    vert.addColorStop(0.45, "rgba(3,5,8,0.05)")
    vert.addColorStop(1, "rgba(3,5,8,0.8)")
    ctx.fillStyle = vert
    ctx.fillRect(0, 0, W, H)

    const glow = ctx.createRadialGradient(1180, 250, 10, 1180, 250, 320)
    glow.addColorStop(0, "rgba(200,169,110,0.20)")
    glow.addColorStop(1, "rgba(200,169,110,0)")
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, W, H)

    ctx.textBaseline = "alphabetic"
    for (const line of LINES) {
      ctx.fillStyle = line.color
      ctx.font = `${line.weight} ${line.size}px ${line.mincho ? MINCHO : SANS}`
      ctx.shadowColor = "rgba(0,0,0,0.85)"
      ctx.shadowBlur = 18
      drawTracked(ctx, line.text, X, line.y, line.size, line.tracking)
      ctx.shadowBlur = 0
    }

    ctx.strokeStyle = "rgba(200,169,110,0.45)"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(X, 232.5)
    ctx.lineTo(X + 260, 232.5)
    ctx.stroke()

    ctx.strokeStyle = "rgba(200,169,110,0.26)"
    ctx.beginPath()
    ctx.moveTo(X, 330.5)
    ctx.lineTo(X + 180, 330.5)
    ctx.stroke()

    setReady(true)
  }, [])

  useEffect(() => {
    render()
  }, [render])

  const savePng = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "otani-x-header-1500x500.png"
      a.click()
      URL.revokeObjectURL(url)
    }, "image/png")
  }, [])

  return (
    <main style={styles.page}>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;500&display=swap"
      />

      <p style={styles.kicker}>OTANI KIKAKU / X HEADER — 1500 × 500</p>

      <div style={styles.frame}>
        <canvas ref={canvasRef} width={W} height={H} style={styles.canvas} />
      </div>

      <div style={styles.actions}>
        <button type="button" onClick={savePng} disabled={!ready} style={styles.btn}>
          PNGで保存（1500×500）
        </button>
        <button type="button" onClick={() => render()} style={styles.btnGhost}>
          再描画
        </button>
      </div>

      <p style={styles.note}>
        セーフゾーン：左下220×220（アイコン）／右下200×100（ボタン）／上下50px（モバイル切り落とし）を避けた配置
      </p>
    </main>
  )
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#07090c",
    color: "#cfc8b8",
    padding: "48px 32px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "20px",
  },
  kicker: {
    fontSize: "11px",
    letterSpacing: "0.34em",
    color: "rgba(200,169,110,0.75)",
    margin: 0,
  },
  frame: {
    width: "min(1500px, 96vw)",
    border: "1px solid rgba(200,169,110,0.18)",
    boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
  },
  canvas: { width: "100%", height: "auto", display: "block" },
  actions: { display: "flex", gap: "12px" },
  btn: {
    padding: "12px 26px",
    background: "transparent",
    border: "1px solid rgba(200,169,110,0.5)",
    color: "#dcb974",
    letterSpacing: "0.14em",
    fontSize: "13px",
    cursor: "pointer",
  },
  btnGhost: {
    padding: "12px 20px",
    background: "transparent",
    border: "1px solid rgba(207,200,184,0.2)",
    color: "rgba(207,200,184,0.7)",
    letterSpacing: "0.14em",
    fontSize: "13px",
    cursor: "pointer",
  },
  note: {
    fontSize: "11px",
    letterSpacing: "0.08em",
    color: "rgba(207,200,184,0.45)",
    margin: 0,
    textAlign: "center",
  },
}
