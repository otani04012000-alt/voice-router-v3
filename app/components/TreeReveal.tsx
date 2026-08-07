'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const seg = (p: number, s: number, e: number) => (e <= s ? 0 : clamp((p - s) / (e - s)))
const ease = (t: number) => 1 - Math.pow(1 - t, 3)

/**
 * 暗闇から霧が引き、木が現れる無音のセクション。
 *
 * `/ma` は単独ページとして、`/shinden` は神域HEROに続く「証明」として使う。
 * 神社側の本文で「枝ではなく、根を設計する。」と述べたあと、
 * スクロールした先で根の張った黒松が現れて裏づけになる。
 *
 * 画像は 2.33:1 と横長なので、縦長の画面では cover の切り取りで
 * 主題である根が画面外へ出る。狭い幅では焦点を右へ寄せて根を残す。
 */
export default function TreeReveal({
  showLine = true,
  heightVh = 400,
}: {
  /** 末尾に金文字を出すか。神社側では本文と重複するため呼び出し側で選ぶ。 */
  showLine?: boolean
  /** セクションの長さ。長いほど「間」が伸びる。 */
  heightVh?: number
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const [p, setP] = useState(0)
  const [reduced, setReduced] = useState(false)
  const [focusX, setFocusX] = useState('50%')

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduced(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  const measure = useCallback(() => {
    // 縦長画面ほど横が切り取られるので、幹と根のある右寄りへ焦点を移す。
    const ratio = window.innerWidth / window.innerHeight
    setFocusX(ratio < 1.2 ? '74%' : ratio < 1.6 ? '62%' : '50%')

    const el = wrapRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const total = rect.height - window.innerHeight
    if (total <= 0) {
      setP(1)
      return
    }
    setP(clamp(-rect.top / total))
  }, [])

  useEffect(() => {
    if (reduced) {
      measure()
      setP(1)
      return
    }
    const onScroll = () => {
      if (rafRef.current !== null) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        measure()
      })
    }
    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', measure)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [measure, reduced])

  const a = ease(seg(p, 0.0, 0.4))
  const b = ease(seg(p, 0.28, 0.74))
  const c = ease(seg(p, 0.8, 1.0))

  const fog = 0.94 - 0.82 * b
  const glow = 0.06 + 0.5 * b
  const ty = 6 - 9 * p

  return (
    <div ref={wrapRef} style={{ height: `${heightVh}vh`, background: '#07090c' }}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflow: 'hidden',
          background: '#07090c',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: '-8vh -4vw',
            backgroundImage: 'url(/ma-bonsai.webp)',
            backgroundSize: 'cover',
            backgroundPosition: `${focusX} 62%`,
            opacity: a,
            filter: `blur(${18 * (1 - a)}px) saturate(${0.55 + 0.25 * a})`,
            transform: `scale(${1.16 - 0.14 * a}) translate3d(0, ${ty}vh, 0)`,
            willChange: a < 1 ? 'transform, opacity, filter' : 'auto',
          }}
        />

        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse at 50% 58%, rgba(216,186,120,0.16), rgba(7,9,12,0) 58%)',
            opacity: glow,
            mixBlendMode: 'screen',
            pointerEvents: 'none',
          }}
        />

        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(7,9,12,0.98) 0%, rgba(7,9,12,0.42) 34%, rgba(7,9,12,0.30) 58%, rgba(7,9,12,0.96) 100%)',
            opacity: fog,
            pointerEvents: 'none',
          }}
        />

        {/* 周縁の落ち込み。終盤は主題を見せるため緩める。 */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 38%, rgba(0,0,0,${(0.78 - 0.3 * b).toFixed(3)}) 100%)`,
            pointerEvents: 'none',
          }}
        />

        {showLine && (
          <div
            style={{
              position: 'absolute',
              left: 'clamp(20px, 7vw, 96px)',
              bottom: 'clamp(64px, 14vh, 160px)',
              opacity: c,
              transform: `translate3d(0, ${(1 - c) * 14}px, 0)`,
              pointerEvents: 'none',
            }}
          >
            <p
              style={{
                margin: 0,
                fontFamily: '"Hiragino Mincho ProN", "Yu Mincho", serif',
                fontSize: 'clamp(17px, 2.5vw, 30px)',
                lineHeight: 1.9,
                letterSpacing: '0.16em',
                color: '#d8ba78',
                textShadow: '0 2px 26px rgba(0,0,0,0.92)',
              }}
            >
              枝ではなく、根を設計する。
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
