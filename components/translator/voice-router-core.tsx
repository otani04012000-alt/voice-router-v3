"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { VoiceSignal } from "./use-voice";

export type RouterVisualState = "idle" | "listening" | "ending" | "stopped" | "translating" | "delivered";

type Props = {
  state: RouterVisualState;
  signal: RefObject<VoiceSignal>;
  sourceLabel: string;
  targetLabel: string;
  phaseLabel: string;
};

type Particle = {
  x: number;
  y: number;
  speed: number;
  size: number;
  phase: number;
  lane: number;
};

const TAU = Math.PI * 2;

export default function VoiceRouterCore({
  state,
  signal,
  sourceLabel,
  targetLabel,
  phaseLabel,
}: Props) {
  const shell = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = shell.current;
    const element = canvas.current;
    if (!host || !element) return;
    const context = element.getContext("2d");
    if (!context) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const particles: Particle[] = Array.from({ length: 132 }, (_, index) => ({
      x: (index * 0.61803398875) % 1,
      y: ((index * 47) % 83) / 83,
      speed: 0.00018 + (index % 7) * 0.000035,
      size: 0.45 + (index % 5) * 0.22,
      phase: (index * 1.73) % TAU,
      lane: (index % 3) - 1,
    }));
    let width = 1;
    let height = 1;
    let frame = 0;
    let start = performance.now();
    let energy = 0;
    let low = 0;
    let mid = 0;
    let high = 0;

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      element.width = Math.round(width * ratio);
      element.height = Math.round(height * ratio);
      element.style.width = `${width}px`;
      element.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const palette = () => {
      if (state === "listening") return { main: "95,212,255", hot: "219,248,255" };
      if (state === "ending") return { main: "255,174,72", hot: "255,238,191" };
      if (state === "stopped") return { main: "95,227,154", hot: "226,255,236" };
      if (state === "translating") return { main: "226,178,255", hot: "255,235,187" };
      if (state === "delivered") return { main: "95,227,154", hot: "232,255,220" };
      return { main: "232,201,106", hot: "255,242,194" };
    };

    const line = (
      fromX: number,
      fromY: number,
      toX: number,
      toY: number,
      bend: number,
      color: string,
      alpha: number,
      lineWidth: number,
    ) => {
      context.beginPath();
      context.moveTo(fromX, fromY);
      context.quadraticCurveTo(width / 2, height / 2 + bend, toX, toY);
      context.strokeStyle = `rgba(${color},${alpha})`;
      context.lineWidth = lineWidth;
      context.stroke();
    };

    const lightning = (
      fromX: number,
      toX: number,
      offset: number,
      color: string,
      strength: number,
      now: number,
    ) => {
      const segments = 22;
      context.save();
      context.beginPath();
      context.moveTo(fromX, height / 2);
      for (let index = 1; index <= segments; index++) {
        const progress = index / segments;
        const x = fromX + (toX - fromX) * progress;
        const taper = Math.sin(progress * Math.PI);
        const noise =
          Math.sin(index * 9.17 + now * 0.018 + offset) * 5.5 * taper +
          Math.sin(index * 2.31 - now * 0.011) * 2.4 * taper;
        context.lineTo(x, height / 2 + noise + offset);
      }
      context.strokeStyle = `rgba(${color},${strength})`;
      context.lineWidth = 1.4;
      context.shadowColor = `rgba(${color},0.95)`;
      context.shadowBlur = 13;
      context.stroke();
      context.lineWidth = 0.5;
      context.strokeStyle = "rgba(255,255,255,0.9)";
      context.shadowBlur = 0;
      context.stroke();
      context.restore();
    };

    const draw = (now: number) => {
      const elapsed = now - start;
      const live = signal.current;
      const active = state === "listening";
      const idleBreath = 0.035 + (Math.sin(now * 0.0017) + 1) * 0.018;
      const closing = state === "ending" ? Math.min(1, elapsed / 1350) : 0;
      const targetEnergy = active ? Math.max(live.level, idleBreath) : state === "ending" ? 0.2 * (1 - closing) : state === "stopped" ? 0.015 : state === "translating" ? 0.32 : state === "delivered" ? 0.13 : idleBreath;
      energy += (targetEnergy - energy) * 0.16;
      low += ((active ? live.low : idleBreath * 0.7) - low) * 0.13;
      mid += ((active ? live.mid : idleBreath) - mid) * 0.13;
      high += ((active ? live.high : idleBreath * 0.55) - high) * 0.13;
      const { main, hot } = palette();
      const centerX = width / 2;
      const centerY = height / 2;
      const coreRadius = Math.min(40, Math.max(25, height * 0.34));

      context.clearRect(0, 0, width, height);

      const glow = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(width * 0.33, 120));
      glow.addColorStop(0, `rgba(${main},${0.28 + energy * 0.24})`);
      glow.addColorStop(0.35, `rgba(${main},${0.09 + energy * 0.12})`);
      glow.addColorStop(1, `rgba(${main},0)`);
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      for (const particle of particles) {
        const pace = state === "translating" ? 4.2 : active ? 1.4 + energy * 4 : 1;
        const x = ((particle.x + now * particle.speed * pace) % 1) * width;
        const wave = Math.sin(now * 0.0014 + particle.phase) * (3 + energy * 10);
        const y = centerY + particle.lane * height * 0.22 + wave;
        const distance = Math.abs(x - centerX) / Math.max(1, width / 2);
        const alpha = (0.18 + energy * 0.3) * (1 - distance * 0.45);
        context.fillStyle = `rgba(${main},${alpha})`;
        context.fillRect(x, y, particle.size + energy * 1.8, particle.size + energy * 1.8);
      }

      for (let lane = -2; lane <= 2; lane++) {
        const bend = lane * (5 + high * 18) + Math.sin(now * 0.0015 + lane) * (2 + mid * 9);
        line(width * 0.02, centerY, width * 0.98, centerY, bend, main, lane === 0 ? 0.62 : 0.22, lane === 0 ? 1.5 : 0.8);
      }

      if (state === "translating") {
        const strike = 0.42 + Math.sin(now * 0.021) * 0.18;
        lightning(centerX - coreRadius * 0.35, width * 0.015, -5, main, strike, now);
        lightning(centerX + coreRadius * 0.35, width * 0.985, 4, main, strike, now);
        if (Math.sin(now * 0.013) > 0.72) {
          lightning(centerX, width * 0.08, 8, hot, 0.28, now + 83);
          lightning(centerX, width * 0.92, -9, hot, 0.28, now + 131);
        }
      }

      for (let index = 0; index < 24; index++) {
        const angle = (index / 24) * TAU + now * 0.00008;
        const inner = coreRadius * (1.05 + energy * 0.2);
        const outer = coreRadius * (1.85 + (index % 3) * 0.18 + energy * 0.5);
        context.beginPath();
        context.moveTo(centerX + Math.cos(angle) * inner, centerY + Math.sin(angle) * inner * 0.72);
        context.lineTo(centerX + Math.cos(angle) * outer, centerY + Math.sin(angle) * outer * 0.72);
        context.strokeStyle = `rgba(${index % 4 === 0 ? hot : main},${0.12 + energy * 0.32})`;
        context.lineWidth = index % 4 === 0 ? 1.15 : 0.55;
        context.stroke();
      }

      if (state === "translating" || state === "delivered") {
        const packetCount = state === "translating" ? 7 : 3;
        for (let index = 0; index < packetCount; index++) {
          const progress = ((elapsed * (state === "translating" ? 0.00055 : 0.00028) + index / packetCount) % 1);
          const x = width * (0.05 + progress * 0.9);
          const y = centerY + Math.sin(progress * Math.PI) * -8;
          const packetGlow = context.createRadialGradient(x, y, 0, x, y, 8);
          packetGlow.addColorStop(0, `rgba(${hot},0.95)`);
          packetGlow.addColorStop(1, `rgba(${main},0)`);
          context.fillStyle = packetGlow;
          context.fillRect(x - 8, y - 8, 16, 16);
        }
      }

      context.save();
      context.translate(centerX, centerY);
      context.rotate(now * 0.00016);
      for (let ring = 0; ring < 2; ring++) {
        context.beginPath();
        context.arc(0, 0, coreRadius + 7 + ring * 8 + energy * 8, 0, TAU);
        context.setLineDash(ring ? [2, 7] : [16, 10]);
        context.lineDashOffset = (ring ? 1 : -1) * now * 0.012;
        context.strokeStyle = `rgba(${main},${ring ? 0.16 : 0.3})`;
        context.lineWidth = ring ? 0.7 : 1;
        context.stroke();
      }
      context.setLineDash([]);
      context.restore();

      const lobes = state === "translating" ? 10 : state === "delivered" ? 8 : 7;
      const closeScale = state === "ending" ? 1 - closing * 0.48 : state === "stopped" ? 0.52 : 1;
      const radius = coreRadius * closeScale * (1 + energy * 0.34 + Math.min(0.16, live.peak * 0.14));
      context.beginPath();
      for (let index = 0; index <= 96; index++) {
        const angle = (index / 96) * TAU;
        const voiceShape = Math.sin(angle * lobes + now * (0.0018 + high * 0.007)) * (2.2 + mid * 8);
        const lowPulse = Math.sin(angle * 3 - now * 0.001) * low * 7;
        const r = radius + voiceShape + lowPulse;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r * (0.86 + high * 0.2);
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.closePath();
      const body = context.createRadialGradient(centerX - radius * 0.32, centerY - radius * 0.4, 1, centerX, centerY, radius * 1.35);
      body.addColorStop(0, `rgba(${hot},0.96)`);
      body.addColorStop(0.28, `rgba(${main},0.88)`);
      body.addColorStop(0.7, `rgba(${main},0.3)`);
      body.addColorStop(1, `rgba(${main},0.03)`);
      context.fillStyle = body;
      context.shadowColor = `rgba(${main},0.82)`;
      context.shadowBlur = 26 + energy * 46;
      context.fill();
      context.shadowBlur = 0;

      const nodeCount = 12;
      for (let index = 0; index < nodeCount; index++) {
        const angle = index / nodeCount * TAU + now * 0.00042;
        const orbit = radius * (1.75 + (index % 3) * 0.18);
        const x = centerX + Math.cos(angle) * orbit;
        const y = centerY + Math.sin(angle * 1.6) * orbit * 0.34;
        context.fillStyle = `rgba(${index % 4 === 0 ? hot : main},${0.35 + energy * 0.5})`;
        context.beginPath();
        context.arc(x, y, 0.8 + (index % 3) * 0.45 + energy * 1.4, 0, TAU);
        context.fill();
      }

      if (state === "listening") {
        const bars = 24;
        for (let index = 0; index < bars; index++) {
          const band = index < 8 ? low : index < 16 ? mid : high;
          const barHeight = 2 + band * 26 + Math.sin(now * 0.008 + index) * energy * 6;
          const x = centerX + (index - (bars - 1) / 2) * 4;
          context.fillStyle = `rgba(${main},${0.3 + band * 0.7})`;
          context.fillRect(x, centerY + coreRadius + 17 - barHeight / 2, 1.5, barHeight);
        }
      }

      if (state === "ending") {
        // 無音を検知してからマイクが閉じるまで、大きな輪を中心へ収束させる。
        // 残り時間が面積として減るので、文字を読まなくても切断の瞬間が分かる。
        const countdownStart = Math.min(height * 0.44, width * 0.16, 58);
        const countdownRadius = Math.max(4, countdownStart * (1 - closing * 0.9));
        const countdownAlpha = 0.98 - closing * 0.16;
        context.beginPath();
        context.arc(centerX, centerY, countdownRadius, 0, TAU);
        context.fillStyle = `rgba(${main},${0.035 + closing * 0.12})`;
        context.fill();
        context.strokeStyle = `rgba(${main},${countdownAlpha})`;
        context.lineWidth = 3.5 + closing * 2.5;
        context.shadowColor = `rgba(${main},0.95)`;
        context.shadowBlur = 14 + closing * 18;
        context.stroke();

        context.beginPath();
        context.arc(centerX, centerY, countdownRadius + 7, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - closing));
        context.strokeStyle = `rgba(${main},${0.95 - closing * 0.35})`;
        context.lineWidth = 2;
        context.lineCap = "round";
        context.shadowColor = `rgba(${main},0.9)`;
        context.shadowBlur = 16;
        context.stroke();
        context.shadowBlur = 0;
        context.lineCap = "butt";
      }

      if (state === "stopped") {
        context.strokeStyle = `rgba(${main},0.9)`;
        context.lineWidth = 3;
        context.lineCap = "round";
        context.lineJoin = "round";
        context.beginPath();
        context.moveTo(centerX - 11, centerY);
        context.lineTo(centerX - 3, centerY + 8);
        context.lineTo(centerX + 13, centerY - 10);
        context.stroke();
        context.lineCap = "butt";
        context.lineJoin = "miter";
      }

      if (state === "delivered") {
        const burst = Math.min(1, elapsed / 900);
        for (let index = 0; index < 18; index++) {
          const angle = index / 18 * TAU;
          const from = radius + 8 + burst * 18;
          const to = from + 7 * (1 - burst);
          context.strokeStyle = `rgba(${main},${0.55 * (1 - burst)})`;
          context.beginPath();
          context.moveTo(centerX + Math.cos(angle) * from, centerY + Math.sin(angle) * from);
          context.lineTo(centerX + Math.cos(angle) * to, centerY + Math.sin(angle) * to);
          context.stroke();
        }
        for (let ring = 0; ring < 3; ring++) {
          const progress = Math.min(1, Math.max(0, elapsed / 1150 - ring * 0.13));
          if (progress <= 0 || progress >= 1) continue;
          context.beginPath();
          context.arc(centerX, centerY, radius + 12 + progress * Math.min(width * 0.34, 240), 0, TAU);
          context.strokeStyle = `rgba(${main},${0.48 * (1 - progress)})`;
          context.lineWidth = 1.4 - progress * 0.8;
          context.shadowColor = `rgba(${main},0.75)`;
          context.shadowBlur = 12;
          context.stroke();
          context.shadowBlur = 0;
        }
      }

      if (!reduced) frame = requestAnimationFrame(draw);
    };

    draw(performance.now());
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [signal, state]);

  return (
    <div ref={shell} className="voice-router-core" data-state={state} aria-label={`${sourceLabel}から${targetLabel}へ、${phaseLabel}`}>
      <canvas ref={canvas} aria-hidden="true" />
      <div className="voice-router-readout" aria-hidden="true">
        <span>{sourceLabel}</span>
        <strong>{phaseLabel}</strong>
        <span>{targetLabel}</span>
      </div>
    </div>
  );
}
