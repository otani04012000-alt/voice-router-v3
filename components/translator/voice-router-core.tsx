"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { VoiceSignal } from "./use-voice";

export type RouterVisualState = "idle" | "listening" | "translating" | "delivered";

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
    const particles: Particle[] = Array.from({ length: 84 }, (_, index) => ({
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

    const draw = (now: number) => {
      const elapsed = now - start;
      const live = signal.current;
      const active = state === "listening";
      const idleBreath = 0.035 + (Math.sin(now * 0.0017) + 1) * 0.018;
      const targetEnergy = active ? Math.max(live.level, idleBreath) : state === "translating" ? 0.32 : state === "delivered" ? 0.13 : idleBreath;
      energy += (targetEnergy - energy) * 0.16;
      low += ((active ? live.low : idleBreath * 0.7) - low) * 0.13;
      mid += ((active ? live.mid : idleBreath) - mid) * 0.13;
      high += ((active ? live.high : idleBreath * 0.55) - high) * 0.13;
      const { main, hot } = palette();
      const centerX = width / 2;
      const centerY = height / 2;
      const coreRadius = Math.min(25, Math.max(17, height * 0.25));

      context.clearRect(0, 0, width, height);

      const glow = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(width * 0.33, 120));
      glow.addColorStop(0, `rgba(${main},${0.11 + energy * 0.2})`);
      glow.addColorStop(0.35, `rgba(${main},${0.035 + energy * 0.08})`);
      glow.addColorStop(1, `rgba(${main},0)`);
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      for (const particle of particles) {
        const pace = state === "translating" ? 4.2 : active ? 1.4 + energy * 4 : 1;
        const x = ((particle.x + now * particle.speed * pace) % 1) * width;
        const wave = Math.sin(now * 0.0014 + particle.phase) * (3 + energy * 10);
        const y = centerY + particle.lane * height * 0.22 + wave;
        const distance = Math.abs(x - centerX) / Math.max(1, width / 2);
        const alpha = (0.08 + energy * 0.22) * (1 - distance * 0.45);
        context.fillStyle = `rgba(${main},${alpha})`;
        context.fillRect(x, y, particle.size + energy * 1.8, particle.size + energy * 1.8);
      }

      for (let lane = -2; lane <= 2; lane++) {
        const bend = lane * (5 + high * 18) + Math.sin(now * 0.0015 + lane) * (2 + mid * 9);
        line(width * 0.04, centerY, width * 0.96, centerY, bend, main, lane === 0 ? 0.32 : 0.1, lane === 0 ? 1.15 : 0.55);
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
      const radius = coreRadius * (1 + energy * 0.34 + Math.min(0.16, live.peak * 0.14));
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
      context.shadowBlur = 14 + energy * 34;
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
