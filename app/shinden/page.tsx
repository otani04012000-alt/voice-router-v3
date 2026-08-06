'use client';
import { useEffect, useRef, useState } from 'react';

const SYS: [string, string, string][] = [
  ['01', '記録', '決定と経緯を残す。残らなければ無かった事。'],
  ['02', '実行', '手で触らずに走らせる。再現性のない手作業は禁止。'],
  ['03', '検証', '動いた証拠を出す。主観の「できた」は却下。'],
  ['04', '停止', 'いつでも止められる。止め方が設計の品質。'],
  ['05', '差分監査', '変わった所だけを見る。全部見る人は何も見ていない。'],
  ['06', '引き継ぎ', '渡せて初めて資産。渡せないものは私物。'],
];

export default function Shinden() {
  const cv = useRef<HTMLCanvasElement>(null);
  const bg = useRef<HTMLImageElement>(null);
  const [hasImg, setHasImg] = useState(true);

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const x = c.getContext('2d');
    if (!x) return;
    const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 1, H = 1, d = 1, t = 0, raf = 0, sc = 0;
    let mxT = 0, myT = 0, mx = 0, my = 0, pxT = -9999, pyT = -9999;
    const rnd = (n: number) => { const q = Math.sin(n * 127.1) * 43758.5453; return q - Math.floor(q); };

    const cloud = (cx: number, cy: number, s: number, flip: number, a: number, drift: number) => {
      x.save();
      x.translate(cx + Math.sin(t * 0.006 + flip) * s * 0.06 + drift, cy + Math.cos(t * 0.004 + flip) * s * 0.03);
      x.scale(flip, 1);
      x.globalCompositeOperation = 'screen';
      for (let i = 0; i < 12; i++) {
        const ang = i * 0.64 + t * 0.03 * flip;
        const r = s * (0.16 + (i % 4) * 0.025) * (1 + 0.08 * Math.sin(t * 0.02 + i));
        const px = Math.cos(ang) * s * (0.22 + i * 0.035);
        const py = Math.sin(ang * 1.3) * s * 0.11;
        const g = x.createRadialGradient(px, py, r * 0.12, px, py, r);
        g.addColorStop(0, `rgba(255,235,158,${a * 0.5})`);
        g.addColorStop(0.38, `rgba(213,158,37,${a * 0.34})`);
        g.addColorStop(0.72, `rgba(109,58,3,${a * 0.16})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g;
        x.beginPath(); x.arc(px, py, r, 0, 6.283); x.fill();
      }
      x.lineWidth = d;
      x.strokeStyle = `rgba(250,213,111,${a * 0.55})`;
      for (let j = 0; j < 3; j++) {
        x.beginPath();
        for (let i = 0; i < 60; i++) {
          const q = i / 59;
          const px = q * s * 0.85;
          const py = j * s * 0.045 + Math.sin(q * 12.56 + j + t * 0.05) * s * 0.045 + Math.sin(q * 31.4 - t * 0.03) * s * 0.014;
          i ? x.lineTo(px, py) : x.moveTo(px, py);
        }
        x.stroke();
      }
      x.restore();
    };

    const draw = () => {
      mx += (mxT - mx) * 0.06;
      my += (myT - my) * 0.06;
      if (bg.current) {
        bg.current.style.transform = `scale(1.16) translate3d(${mx * -2.2}%, ${my * -1.6 - sc * 4}%, 0)`;
      }
      x.clearRect(0, 0, W, H);
      const sx = W * (0.56 + Math.sin(t * 0.004) * 0.03 - mx * 0.04);
      const sy = -H * 0.05;
      x.save();
      x.globalCompositeOperation = 'screen';
      for (let i = 0; i < 8; i++) {
        const ang = 0.74 + i * 0.12 + Math.sin(t * 0.008 + i) * 0.012;
        const L = H * 1.5;
        const w = 0.02 + (i % 3) * 0.013;
        const pulse = 0.55 + 0.45 * Math.sin(t * 0.037 + i * 0.9);
        const A = (0.035 + (i % 4) * 0.018) * pulse;
        const g = x.createLinearGradient(sx, sy, sx + Math.cos(ang) * L, sy + Math.sin(ang) * L);
        g.addColorStop(0, `rgba(255,251,229,${A * 2.8})`);
        g.addColorStop(0.5, `rgba(244,207,119,${A})`);
        g.addColorStop(1, 'rgba(212,175,55,0)');
        x.fillStyle = g;
        x.beginPath();
        x.moveTo(sx, sy);
        x.lineTo(sx + Math.cos(ang - w) * L, sy + Math.sin(ang - w) * L);
        x.lineTo(sx + Math.cos(ang + w) * L, sy + Math.sin(ang + w) * L);
        x.closePath(); x.fill();
      }
      x.restore();
      cloud(W * -0.06, H * 0.2, H * 0.55, 1, 0.46, mx * W * 0.05);
      cloud(W * 1.06, H * 0.24, H * 0.48, -1, 0.42, mx * W * 0.05);
      cloud(W * -0.1, H * 0.62, H * 0.36, 1, 0.26, mx * W * 0.03);
      cloud(W * 1.08, H * 0.6, H * 0.32, -1, 0.24, mx * W * 0.03);
      x.save();
      x.globalCompositeOperation = 'screen';
      for (let i = 0; i < 130; i++) {
        let dx = rnd(i * 2.7) * W + Math.sin(t * 0.02 + i) * 14 * d;
        let dy = ((rnd(i * 8.1) * H - t * (0.5 + rnd(i) * 1.4) * d) % H + H) % H;
        const ddx = dx - pxT, ddy = dy - pyT, dist = Math.hypot(ddx, ddy), R = 150 * d;
        if (dist < R) { const f = Math.pow(1 - dist / R, 2) * 55 * d; dx += (ddx / (dist || 1)) * f; dy += (ddy / (dist || 1)) * f; }
        const r = (0.4 + rnd(i * 5.2) * 1.9) * d;
        const A = 0.14 + 0.46 * Math.abs(Math.sin(t * 0.05 + i));
        x.fillStyle = `rgba(255,226,135,${A})`;
        x.beginPath(); x.arc(dx, dy, r, 0, 6.283); x.fill();
      }
      x.restore();
      const fog = x.createLinearGradient(0, H * 0.66, 0, H);
      const fs = 0.07 + 0.03 * Math.sin(t * 0.012);
      fog.addColorStop(0, 'rgba(0,0,0,0)');
      fog.addColorStop(0.5, `rgba(221,191,126,${fs})`);
      fog.addColorStop(1, 'rgba(0,0,0,0.2)');
      x.fillStyle = fog;
      x.fillRect(0, H * 0.64, W, H * 0.36);
    };

    const size = () => {
      d = Math.min(window.devicePixelRatio || 1, 2);
      W = c.width = window.innerWidth * d;
      H = c.height = window.innerHeight * d;
      draw();
    };
    const move = (e: PointerEvent) => {
      mxT = e.clientX / window.innerWidth - 0.5;
      myT = e.clientY / window.innerHeight - 0.5;
      pxT = e.clientX * d; pyT = e.clientY * d;
    };
    const scroll = () => { sc = Math.min(1, window.scrollY / Math.max(1, window.innerHeight)); };
    const loop = () => { t += 1; draw(); raf = requestAnimationFrame(loop); };

    size();
    window.addEventListener('resize', size);
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('scroll', scroll, { passive: true });
    if (rm) draw(); else loop();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', size);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('scroll', scroll);
    };
  }, []);

  const serif = '"Hiragino Mincho ProN","Yu Mincho",serif';
  const mono = 'ui-monospace,SFMono-Regular,Menlo,monospace';

  return (
    <main style={{ background: '#05080b', color: '#eee8d9', fontFamily: serif }}>
      <section style={{ position: 'relative', height: '100vh', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          {hasImg ? (
            <img ref={bg} src="/shinden.jpg" alt="" onError={() => setHasImg(false)}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.16)', willChange: 'transform' }} />
          ) : (
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 56% 12%, rgba(73,148,198,.55), transparent 55%), linear-gradient(180deg,#1e2220,#183247 33%,#10140f 70%,#050604)' }} />
          )}
        </div>
        <canvas ref={cv} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(90deg,rgba(2,5,8,.82),rgba(2,5,8,.2) 52%,rgba(2,5,8,.08)), radial-gradient(ellipse at 50% 45%, transparent 30%, rgba(0,0,0,.66) 100%)' }} />
        <header style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '28px 4.5vw', display: 'flex', justifyContent: 'space-between', font: `10px ${mono}`, letterSpacing: '.25em', color: '#d8bf72' }}>
          <span>SEKAIJU / SIGNAL STATION</span>
          <span>NODE 00 ・ MENU</span>
        </header>
        <div style={{ position: 'absolute', left: '8vw', top: '50%', transform: 'translateY(-46%)', width: 'min(620px,60vw)', textShadow: '0 3px 22px #000' }}>
          <div style={{ font: `10px ${mono}`, letterSpacing: '.38em', color: '#d6bd70', marginBottom: 22 }}>制作OS / OBSERVATORY</div>
          <h1 style={{ margin: 0, fontSize: 'clamp(76px,13vw,180px)', fontWeight: 500, letterSpacing: '.06em', lineHeight: 0.86, background: 'linear-gradient(115deg,#8f681d,#f3df9a 46%,#c79528 72%,#fff1b5)', WebkitBackgroundClip: 'text', color: 'transparent', filter: 'drop-shadow(0 8px 20px rgba(0,0,0,.75))' }}>世界樹</h1>
          <div style={{ font: `10px ${mono}`, letterSpacing: '.38em', color: '#dfc46b', marginTop: 22 }}>SOME TRUTHS LIVE BENEATH THE SURFACE.</div>
          <p style={{ maxWidth: '32em', marginTop: 26, fontSize: 'clamp(12px,1.3vw,15px)', lineHeight: 2.1, color: 'rgba(242,236,218,.8)' }}>
            枝ではなく、根を設計する。記録・実行・検証・停止。<br />明日も動く仕組みだけを、神域の奥へ残す。
          </p>
        </div>
        <div style={{ position: 'absolute', left: '50%', bottom: '4vh', transform: 'translateX(-50%)', font: `9px ${mono}`, letterSpacing: '.3em', color: 'rgba(232,215,159,.7)', textAlign: 'center' }}>
          SCROLL
          <i style={{ display: 'block', width: 1, height: 46, margin: '10px auto 0', background: 'linear-gradient(#c9a94e,transparent)', animation: 'shindenScroll 2.4s ease-in-out infinite' }} />
        </div>
        <a href="/world-tree" style={{ position: 'absolute', right: '5vw', bottom: '6vh', color: '#e8d79f', font: `10px ${mono}`, letterSpacing: '.3em', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 16 }}>
          VIEW SYSTEMS<i style={{ display: 'block', width: 70, height: 1, background: '#c9a94e' }} />
        </a>
      </section>

      <section style={{ padding: '18vh 8vw', maxWidth: 1080, margin: '0 auto' }}>
        <div style={{ font: `10px ${mono}`, letterSpacing: '.38em', color: '#d6bd70', marginBottom: 40 }}>01 / 系統 :: CORE SUBSYSTEMS</div>
        <h2 style={{ fontSize: 'clamp(26px,4.4vw,52px)', fontWeight: 400, letterSpacing: '.04em', margin: '0 0 56px', color: '#f0e8cf' }}>制作OSは、動詞でできている。</h2>
        <div style={{ borderTop: '1px solid rgba(201,169,78,.22)' }}>
          {SYS.map(([no, name, desc]) => (
            <div key={no} className="shindenRow" style={{ display: 'flex', alignItems: 'baseline', gap: 'clamp(14px,3vw,44px)', padding: '26px 4px', borderBottom: '1px solid rgba(201,169,78,.14)', transition: 'transform .45s cubic-bezier(.16,1,.3,1), background .45s' }}>
              <span style={{ font: `10px ${mono}`, color: '#c9a94e', letterSpacing: '.2em' }}>{no}</span>
              <span style={{ fontSize: 'clamp(17px,2.2vw,25px)', minWidth: '5.5em', color: '#f2ecda' }}>{name}</span>
              <span style={{ fontSize: 'clamp(11px,1.15vw,13px)', lineHeight: 2, color: 'rgba(236,229,208,.6)' }}>{desc}</span>
            </div>
          ))}
        </div>
        <a href="/world-tree" style={{ display: 'inline-flex', alignItems: 'center', gap: 16, marginTop: 70, color: '#e8d79f', font: `10px ${mono}`, letterSpacing: '.3em', textDecoration: 'none' }}>
          ENTER WORLD TREE<i style={{ display: 'block', width: 78, height: 1, background: '#c9a94e' }} />
        </a>
      </section>

      <style>{`
        html,body{margin:0;background:#05080b}
        @keyframes shindenScroll{0%,100%{opacity:.25;transform:scaleY(.4)}50%{opacity:1;transform:scaleY(1)}}
        .shindenRow:hover{transform:translateX(14px);background:linear-gradient(90deg,rgba(201,169,78,.09),transparent)}
        @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
      `}</style>
    </main>
  );
}
