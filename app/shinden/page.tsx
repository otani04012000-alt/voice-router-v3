'use client';
import { useEffect, useRef, useState } from 'react';

export default function Shinden() {
  const cv = useRef<HTMLCanvasElement>(null);
  const [hasImg, setHasImg] = useState(true);
  const m = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  useEffect(() => {
    const c = cv.current; if (!c) return;
    const x = c.getContext('2d'); if (!x) return;
    const rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 1, H = 1, d = 1, t = 0, raf = 0;
    const rnd = (n: number) => { const q = Math.sin(n * 127.1) * 43758.5453; return q - Math.floor(q); };

    const size = () => {
      d = Math.min(devicePixelRatio || 1, 2);
      W = c.width = innerWidth * d; H = c.height = innerHeight * d; draw();
    };
    const move = (e: PointerEvent) => { m.current.tx = e.clientX / innerWidth - 0.5; m.current.ty = e.clientY / innerHeight - 0.5; };

    const cloud = (cx: number, cy: number, s: number, flip: number, a: number) => {
      x.save(); x.translate(cx, cy); x.scale(flip, 1); x.globalCompositeOperation = 'screen';
      for (let i = 0; i < 12; i++) {
        const ang = i * 0.64 + t * 0.012, r = s * (0.16 + (i % 4) * 0.025);
        const px = Math.cos(ang) * s * (0.22 + i * 0.035), py = Math.sin(ang * 1.3) * s * 0.11;
        const g = x.createRadialGradient(px, py, r * 0.12, px, py, r);
        g.addColorStop(0, `rgba(255,235,158,${a * 0.46})`);
        g.addColorStop(0.38, `rgba(213,158,37,${a * 0.33})`);
        g.addColorStop(0.72, `rgba(109,58,3,${a * 0.16})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, 6.283); x.fill();
      }
      x.lineWidth = d; x.strokeStyle = `rgba(250,213,111,${a * 0.6})`;
      for (let j = 0; j < 3; j++) {
        x.beginPath();
        for (let i = 0; i < 60; i++) {
          const q = i / 59, px = q * s * 0.85;
          const py = j * s * 0.045 + Math.sin(q * 12.56 + j) * s * 0.045 + Math.sin(q * 31.4) * s * 0.012;
          i ? x.lineTo(px, py) : x.moveTo(px, py);
        }
        x.stroke();
      }
      x.restore();
    };

    const draw = () => {
      m.current.x += (m.current.tx - m.current.x) * 0.03;
      m.current.y += (m.current.ty - m.current.y) * 0.03;
      x.clearRect(0, 0, W, H);
      const sx = W * 0.56, sy = -H * 0.04;
      x.save(); x.globalCompositeOperation = 'screen';
      for (let i = 0; i < 8; i++) {
        const ang = 0.74 + i * 0.12, L = H * 1.4, w = 0.022 + (i % 3) * 0.012, A = 0.03 + (i % 4) * 0.016;
        const g = x.createLinearGradient(sx, sy, sx + Math.cos(ang) * L, sy + Math.sin(ang) * L);
        g.addColorStop(0, `rgba(255,251,229,${A * 2.6})`);
        g.addColorStop(0.5, `rgba(244,207,119,${A})`);
        g.addColorStop(1, 'rgba(212,175,55,0)');
        x.fillStyle = g; x.beginPath(); x.moveTo(sx, sy);
        x.lineTo(sx + Math.cos(ang - w) * L, sy + Math.sin(ang - w) * L);
        x.lineTo(sx + Math.cos(ang + w) * L, sy + Math.sin(ang + w) * L);
        x.closePath(); x.fill();
      }
      x.restore();
      const px = m.current.x;
      cloud(W * (-0.08 - px * 0.05), H * 0.2, H * 0.55, 1, 0.44);
      cloud(W * (1.08 - px * 0.05), H * 0.24, H * 0.48, -1, 0.4);
      cloud(W * (-0.12 - px * 0.03), H * 0.62, H * 0.36, 1, 0.26);
      cloud(W * (1.1 - px * 0.03), H * 0.6, H * 0.32, -1, 0.24);
      x.save(); x.globalCompositeOperation = 'screen';
      for (let i = 0; i < 110; i++) {
        const dx = rnd(i * 2.7) * W;
        const dy = ((rnd(i * 8.1) * H - t * (0.08 + rnd(i) * 0.25) * d) % H + H) % H;
        const r = (0.35 + rnd(i * 5.2) * 1.8) * d;
        const A = 0.1 + 0.4 * Math.abs(Math.sin(t * 0.025 + i));
        x.fillStyle = `rgba(255,226,135,${A})`; x.beginPath(); x.arc(dx, dy, r, 0, 6.283); x.fill();
      }
      x.restore();
      const fog = x.createLinearGradient(0, H * 0.68, 0, H);
      fog.addColorStop(0, 'rgba(0,0,0,0)');
      fog.addColorStop(0.5, 'rgba(221,191,126,0.08)');
      fog.addColorStop(1, 'rgba(0,0,0,0.18)');
      x.fillStyle = fog; x.fillRect(0, H * 0.66, W, H * 0.34);
    };

    const loop = () => { t++; draw(); raf = requestAnimationFrame(loop); };
    size();
    addEventListener('resize', size);
    addEventListener('pointermove', move, { passive: true });
    if (rm) draw(); else loop();
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', size); removeEventListener('pointermove', move); };
  }, []);

  const serif = '"Hiragino Mincho ProN","Yu Mincho",serif';
  const mono = 'ui-monospace,SFMono-Regular,Menlo,monospace';

  return (
    <main style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#05080b', color: '#eee8d9', fontFamily: serif }}>
      {hasImg ? (
        <img src="/shinden.jpg" alt="" onError={() => setHasImg(false)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', animation: 'shindenPush 20s ease-in-out infinite alternate' }} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 56% 12%, rgba(73,148,198,.55), transparent 55%), linear-gradient(180deg,#1e2220,#183247 33%,#10140f 70%,#050604)' }} />
      )}
      <canvas ref={cv} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(90deg,rgba(2,5,8,.82),rgba(2,5,8,.2) 52%,rgba(2,5,8,.08)), radial-gradient(ellipse at 50% 45%, transparent 30%, rgba(0,0,0,.66) 100%)' }} />
      <header style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '28px 4.5vw', display: 'flex', justifyContent: 'space-between', alignItems: 'center', font: `10px ${mono}`, letterSpacing: '.25em', color: '#d8bf72' }}>
        <span>SEKAIJU / SIGNAL STATION</span>
        <span>NODE 00 ・ MENU</span>
      </header>
      <section style={{ position: 'absolute', left: '8vw', top: '50%', transform: 'translateY(-42%)', width: 'min(620px,58vw)', textShadow: '0 3px 22px #000' }}>
        <div style={{ font: `10px ${mono}`, letterSpacing: '.38em', color: '#d6bd70', marginBottom: 22 }}>制作OS / OBSERVATORY</div>
        <h1 style={{ margin: 0, fontSize: 'clamp(76px,13vw,180px)', fontWeight: 500, letterSpacing: '.06em', lineHeight: 0.86, background: 'linear-gradient(115deg,#8f681d,#f3df9a 46%,#c79528 72%,#fff1b5)', WebkitBackgroundClip: 'text', color: 'transparent', filter: 'drop-shadow(0 8px 20px rgba(0,0,0,.75))' }}>世界樹</h1>
        <div style={{ font: `10px ${mono}`, letterSpacing: '.38em', color: '#dfc46b', marginTop: 22 }}>SOME TRUTHS LIVE BENEATH THE SURFACE.</div>
        <p style={{ maxWidth: '32em', marginTop: 26, fontSize: 'clamp(12px,1.3vw,15px)', lineHeight: 2.1, color: 'rgba(242,236,218,.78)' }}>
          枝ではなく、根を設計する。記録・実行・検証・停止。<br />明日も動く仕組みだけを、神域の奥へ残す。
        </p>
      </section>
      <a href="/world-tree" style={{ position: 'absolute', right: '5vw', bottom: '6vh', color: '#e8d79f', font: `10px ${mono}`, letterSpacing: '.3em', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 16 }}>
        VIEW SYSTEMS<i style={{ display: 'block', width: 70, height: 1, background: '#c9a94e' }} />
      </a>
      <style>{`@keyframes shindenPush{from{transform:scale(1.04)}to{transform:scale(1.11)}}@media(prefers-reduced-motion:reduce){img{animation:none!important}}`}</style>
    </main>
  );
}
