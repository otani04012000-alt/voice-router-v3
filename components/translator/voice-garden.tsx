"use client";

import { useEffect, useRef } from "react";

type VoiceGardenProps = {
  state: string;
  signal: { current: { level: number } };
};

type Point = { x: number; y: number; strength: number };

const GOLD = [218, 181, 91] as const;
const PALE_GOLD = [255, 236, 174] as const;

function seededNoise(seed: number) {
  const value = Math.sin(seed * 91.73 + 17.19) * 43758.5453;
  return value - Math.floor(value);
}

export default function VoiceGarden({ state, signal }: VoiceGardenProps) {
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

      const columns = 10;
      const rows = 8;
      const points: Point[] = [];

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const index = row * columns + column;
          const offsetX = (seededNoise(index + 1) - .5) * width * .105;
          const offsetY = (seededNoise(index + 31) - .5) * height * .13;
          const driftX = Math.sin(time * .16 + index * 1.37) * width * .012;
          const driftY = Math.cos(time * .13 + index * .91) * height * .016;
          points.push({
            x: (column + .35 + (row % 2) * .28) * width / columns + offsetX + driftX,
            y: (row + .32) * height / rows + offsetY + driftY,
            strength: .55 + seededNoise(index + 73) * .75,
          });
        }
      }

      const connectionRange = Math.max(width, height) * .235;
      context.globalCompositeOperation = "screen";

      for (let first = 0; first < points.length; first += 1) {
        const a = points[first];
        for (let second = first + 1; second < points.length; second += 1) {
          if ((first * 7 + second * 11) % 5 === 0) continue;
          const b = points[second];
          const distance = Math.hypot(a.x - b.x, a.y - b.y);
          if (distance > connectionRange) continue;

          const fade = 1 - distance / connectionRange;
          const alpha = (.075 + energy * .05) * fade * a.strength * (1 - stopped * .7);
          context.beginPath();
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
          context.strokeStyle = `rgba(${GOLD.join(",")},${alpha})`;
          context.lineWidth = .55 + fade * .6;
          context.stroke();
        }
      }

      for (let index = 0; index < points.length; index += 1) {
        const point = points[index];
        const pulse = .72 + Math.sin(time * .8 + index * .77) * .28;
        if (index % 3 === 0) {
          drawGlow(point.x, point.y, 8 + point.strength * 8, (.12 + energy * .08) * pulse);
        }
        context.beginPath();
        context.arc(point.x, point.y, .75 + point.strength * .65, 0, Math.PI * 2);
        context.fillStyle = `rgba(${PALE_GOLD.join(",")},${.3 + point.strength * .25})`;
        context.fill();
      }

      const sweep = reducedMotion ? width * .48 : ((time * width * .07) % (width * 1.5)) - width * .25;
      const beam = context.createLinearGradient(sweep - width * .2, 0, sweep + width * .2, height);
      beam.addColorStop(0, "rgba(218,181,91,0)");
      beam.addColorStop(.48, `rgba(255,229,151,${.08 + energy * .08})`);
      beam.addColorStop(.52, `rgba(218,181,91,${.16 + energy * .1})`);
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
    </div>
  );
}
