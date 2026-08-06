'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const seg = (p: number, s: number, e: number) => (e <= s ? 0 : clamp((p - s) / (e - s)))
const ease = (t: number) => 1 - Math.pow(1 - t, 3)

export default function MaPage() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [p, setP] = useState(0)
  const [reduced, setReduced] = useState(false)
  const raf = useRef<number | null>(null)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduced(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  const measure = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const total = rect.height - window.innerHeight
    if (total <= 0) { setP(1); return }
    setP(clamp(-rect.top / total))
  }, [])

  useEffect(() => {
    if (reduced) { setP(1); return }
    const onScroll = () => {
      if (raf.current !== null) return
      raf.current = requestAnimationFrame(() => {
        raf.current = null
        measure()
      })
    }
    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', measure)
      if (raf.current !== null) cancelAnimationFrame(raf.current)
    }
  }, [measure, reduced])

  const a = ease(seg(p, 0.0, 0.4))
  const b = ease(seg(p, 0.28, 0.74))
  const c = ease(seg(p, 0.8, 1.0))

  const op = a
  const sc = 1.16 - 0.14 * a
  const bl = 18 * (1 - a)
  const fog = 0.94 - 0.82 * b
  const glow = 0.06 + 0.5 * b
  const ty = 6 - 9 * p

  return (
    <div ref={wrapRef} style={{ height: '400vh', background: '#07090c' }}>
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
            backgroundImage: 'url(/ma-bonsai.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: '50% 62%',
            opacity: op,
            filter: `blur(${bl}px) saturate(${0.55 + 0.25 * a})`,
            transform: `scale(${sc}) translate3d(0, ${ty}vh, 0)`,
            willChange: 'transform, opacity, filter',
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

        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.78) 100%)',
            pointerEvents: 'none',
          }}
        />

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
      </div>
    </div>
  )
}
