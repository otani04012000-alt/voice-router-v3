"use client";

import { useEffect, useRef } from "react";

type VoiceGardenProps = {
  state: string;
  signal: { current: { level: number } };
  phaseLabel: string;
};

type Point = { x: number; y: number; strength: number };

const GOLD = [218, 181, 91] as const;
const PALE_GOLD = [255, 236, 174] as const;

function seededNoise(seed: number) {
  const value = Math.sin(seed * 91.73 + 17.19) * 43758.5453;
  return value - Math.floor(value);
}

export default function VoiceGarden({ state, signal, phaseLabel }: VoiceGardenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let lastTime = performance.now();
    let stateStarted = lastTime;
    let previousState = stateRef.current;
    let energy = 0;
    let stopped = 0;

    const drawGlow = (x: number, y: number, radius: number, alpha: number) => {
      const glow = context.createRadialGradient(x, y, 0, x, y, radius);
      glow.addColorStop(0, `rgba(${PALE_GOLD.join(",")},${alpha})`);
      glow.addColorStop(.18, `rgba(${GOLD.join(",")},${alpha * .76})`);
      glow.addColorStop(1, `rgba(${GOLD.join(",")},0)`);
      context.fillStyle = glow;
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    };

    const draw = (now: number) => {
      const bounds = canvas.getBoundingClientRect();
      const width = bounds.width;
      const height = bounds.height;
      const delta = Math.min(.05, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;

      if (width < 1 || height < 1) {
        frame = requestAnimationFrame(draw);
        return;
      }

      const density = Math.min(devicePixelRatio || 1, 1.4);
      const targetWidth = Math.round(width * density);
      const targetHeight = Math.round(height * density);
      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        context.setTransform(density, 0, 0, density, 0, 0);
      }

      const active = stateRef.current === "listening" || stateRef.current === "ending";
      const ended = stateRef.current === "stopped";
      if (stateRef.current !== previousState) {
        previousState = stateRef.current;
        stateStarted = now;
      }
      const stateElapsed = now - stateStarted;
      const closing = stateRef.current === "ending" ? Math.min(1, stateElapsed / 1350) : 0;
      const rawLevel = Number.isFinite(signal.current.level) ? signal.current.level : 0;
      const targetEnergy = active ? Math.max(0, Math.min(1, rawLevel * 2.4)) : 0;
      energy += (targetEnergy - energy) * (1 - Math.exp(-delta * 8));
      stopped += (Number(ended) - stopped) * (1 - Math.exp(-delta * 8));

      const time = reducedMotion ? 0 : now / 1000;
      context.clearRect(0, 0, width, height);

      const backdrop = context.createLinearGradient(0, 0, width, height);
      backdrop.addColorStop(0, "rgba(2,10,17,.66)");
      backdrop.addColorStop(.48, "rgba(7,18,26,.3)");
      backdrop.addColorStop(1, "rgba(1,7,12,.72)");
      context.fillStyle = backdrop;
      context.fillRect(0, 0, width, height);

      const hubs = [
        { x: .08, y: .12 },
        { x: .34, y: .2 },
        { x: .72, y: .12 },
        { x: .92, y: .34 },
        { x: .18, y: .52 },
        { x: .55, y: .48 },
        { x: .82, y: .68 },
        { x: .28, y: .84 },
        { x: .62, y: .9 },
      ];
      const points: Point[] = [];
      const centerX = width / 2;
      const centerY = height / 2;
      const activity = stateRef.current === "listening" ? 1 : 0;
      const flowRate = .36 + activity * (1.1 + energy * 4.2);
      const breath = Math.sin(time * (1.4 + energy * 2.4)) * (.035 + activity * .045);

      for (let index = 0; index < 156; index += 1) {
        const hub = hubs[Math.floor(seededNoise(index + 4) * hubs.length)];
        const angle = seededNoise(index + 17) * Math.PI * 2;
        const radius = Math.pow(seededNoise(index + 43), 1.7);
        const spreadX = width * (.07 + seededNoise(index + 61) * .16);
        const spreadY = height * (.08 + seededNoise(index + 79) * .18);
        const hubDriftX = Math.sin(time * flowRate + index * .31) * width * (.025 + activity * .035 + energy * .045);
        const hubDriftY = Math.cos(time * flowRate * .82 + index * .23) * height * (.026 + activity * .032 + energy * .04);
        const rawX = hub.x * width + Math.cos(angle + time * flowRate * .08) * spreadX * radius + hubDriftX;
        const rawY = hub.y * height + Math.sin(angle - time * flowRate * .065) * spreadY * radius + hubDriftY;
        const dx = rawX - centerX;
        const dy = rawY - centerY;
        const radialScale = 1 + breath + energy * .24;
        const collapseScale = stateRef.current === "ending" ? (1 - closing) ** 2 : ended ? 0 : radialScale;
        const collapseSpin = closing * Math.PI * 10;
        const cos = Math.cos(collapseSpin);
        const sin = Math.sin(collapseSpin);
        points.push({
          x: centerX + (dx * cos - dy * sin) * collapseScale,
          y: centerY + (dx * sin + dy * cos) * collapseScale,
          strength: .5 + seededNoise(index + 97) * .9,
        });
      }

      context.globalCompositeOperation = "screen";

      for (let strand = 0; strand < 82; strand += 1) {
        const start = points[(strand * 17) % points.length];
        const end = points[(strand * 47 + 29) % points.length];
        const sway = Math.sin(time * flowRate * .7 + strand * .47);
        context.beginPath();
        context.moveTo(start.x, start.y);
        context.bezierCurveTo(
          centerX + (width * seededNoise(strand + 121) - centerX) * (stateRef.current === "ending" ? (1 - closing) ** 2 : 1),
          centerY + (height * (.5 + sway * .24) - centerY) * (stateRef.current === "ending" ? (1 - closing) ** 2 : 1),
          centerX + (width * seededNoise(strand + 211) - centerX) * (stateRef.current === "ending" ? (1 - closing) ** 2 : 1),
          centerY + (height * (.5 - sway * .24) - centerY) * (stateRef.current === "ending" ? (1 - closing) ** 2 : 1),
          end.x,
          end.y,
        );
        context.strokeStyle = `rgba(${GOLD.join(",")},${(.045 + energy * .035) * (1 - stopped * .7)})`;
        context.lineWidth = .45 + (strand % 5 === 0 ? .7 : 0);
        context.stroke();
      }

      for (let pass = 0; pass < 2; pass += 1) {
        for (let first = 0; first < points.length; first += 1) {
          const a = points[first];
          for (let link = 0; link < 5; link += 1) {
            const jump = 3 + Math.floor(seededNoise(first * 13 + link * 37) * (points.length - 4));
            const b = points[(first + jump) % points.length];
            const distance = Math.hypot(a.x - b.x, a.y - b.y);
            const distanceFade = Math.max(.22, 1 - distance / (Math.max(width, height) * 1.15));
            const baseAlpha = pass === 0 ? .045 : .13;
            const alpha = (baseAlpha + energy * .05) * distanceFade * a.strength * (1 - stopped * .7);
            context.beginPath();
            context.moveTo(a.x, a.y);
            context.lineTo(b.x, b.y);
            context.strokeStyle = `rgba(${GOLD.join(",")},${alpha})`;
            context.lineWidth = pass === 0 ? 2.4 : .5 + a.strength * .28;
            context.stroke();
          }
        }
      }

      for (let first = 0; first < points.length; first += 1) {
        const a = points[first];
        for (let second = first + 1; second < points.length; second += 1) {
          const b = points[second];
          const distance = Math.hypot(a.x - b.x, a.y - b.y);
          if (distance > Math.max(width, height) * .115) continue;
          context.beginPath();
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
          context.strokeStyle = `rgba(${PALE_GOLD.join(",")},${(.12 + energy * .05) * (1 - stopped * .7)})`;
          context.lineWidth = .55;
          context.stroke();
        }
      }

      for (let index = 0; index < points.length; index += 1) {
        const point = points[index];
        const pulse = .72 + Math.sin(time * .8 + index * .77) * .28;
        if (index % 5 === 0) {
          drawGlow(point.x, point.y, 10 + point.strength * 12, (.16 + energy * .1) * pulse);
        }
        context.beginPath();
        context.arc(point.x, point.y, .55 + point.strength * .52, 0, Math.PI * 2);
        context.fillStyle = `rgba(${PALE_GOLD.join(",")},${.42 + point.strength * .3})`;
        context.fill();
      }

      if (stateRef.current === "listening") {
        const listeningRadius = Math.min(width, height) * (.105 + energy * .09 + Math.sin(time * 4.2) * .012);
        for (let ring = 0; ring < 3; ring += 1) {
          context.beginPath();
          context.arc(centerX, centerY, listeningRadius + ring * 11, 0, Math.PI * 2);
          context.strokeStyle = `rgba(${ring === 0 ? PALE_GOLD.join(",") : GOLD.join(",")},${.42 - ring * .1 + energy * .28})`;
          context.lineWidth = ring === 0 ? 2.2 : .8;
          context.stroke();
        }
      }

      if (stateRef.current === "ending") {
        const countdownRadius = Math.max(5, Math.min(width, height) * .23 * (1 - closing * .94));
        context.beginPath();
        context.arc(centerX, centerY, countdownRadius, 0, Math.PI * 2);
        context.fillStyle = `rgba(255,116,70,${.035 + closing * .2})`;
        context.fill();
        context.strokeStyle = `rgba(255,${Math.round(196 - closing * 80)},${Math.round(92 - closing * 45)},${.95 - closing * .08})`;
        context.lineWidth = 3 + closing * 5;
        context.shadowColor = "rgba(255,137,67,.95)";
        context.shadowBlur = 18 + closing * 30;
        context.stroke();
        context.beginPath();
        context.arc(centerX, centerY, countdownRadius + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - closing));
        context.strokeStyle = `rgba(${PALE_GOLD.join(",")},${1 - closing * .35})`;
        context.lineWidth = 2.2;
        context.stroke();
        context.shadowBlur = 0;
      }

      if (ended) {
        drawGlow(centerX, centerY, Math.min(width, height) * .16, .36);
      }

      const sweep = reducedMotion ? width * .48 : ((time * width * .07) % (width * 1.5)) - width * .25;
      const beam = context.createLinearGradient(sweep - width * .2, 0, sweep + width * .2, height);
      beam.addColorStop(0, "rgba(218,181,91,0)");
      beam.addColorStop(.48, `rgba(255,229,151,${.055 + energy * .06})`);
      beam.addColorStop(.52, `rgba(218,181,91,${.1 + energy * .08})`);
      beam.addColorStop(1, "rgba(218,181,91,0)");
      context.fillStyle = beam;
      context.fillRect(0, 0, width, height);

      context.globalCompositeOperation = "source-over";
      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [signal]);

  return (
    <div className="voice-garden" aria-hidden="true">
      <canvas ref={canvasRef} />
      <div className="voice-garden-status" data-state={state}>
        <span className="voice-garden-status-core">
          <i />
          <i />
          <i />
          {state === "stopped" ? <b>✓</b> : null}
        </span>
        <strong>{phaseLabel}</strong>
      </div>
    </div>
  );
}
