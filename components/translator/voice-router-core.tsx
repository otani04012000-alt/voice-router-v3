"use client";
import VoiceGarden from "./voice-garden";

import { useEffect, useRef, type RefObject } from "react";
import type { VoiceSignal } from "./use-voice";

export type RouterVisualState = "idle" | "listening" | "ending" | "stopped" | "translating" | "speaking" | "delivered";

type Props = {
  state: RouterVisualState;
  signal: RefObject<VoiceSignal>;
  sourceLabel: string;
  targetLabel: string;
  phaseLabel: string;
  waitingLabel?: string;
  quietLabel?: string;
  heardLabel?: string;
  levelLabel?: string;
  variant?: "compact" | "landscape";
};

type Particle = {
  x: number;
  y: number;
  speed: number;
  size: number;
  phase: number;
  lane: number;
};

type FieldStrand = {
  phase: number;
  fold: number;
  depth: number;
  color: number;
};

type AssistMote = {
  homeX: number;
  homeY: number;
  scatterX: number;
  scatterY: number;
  phase: number;
};

export function voiceMotion(state: string, elapsed: number, level = 0) {
  const t = Math.max(0, elapsed);
  const energy = Math.max(0, Math.min(1, level));
  if (state === "ending") {
    const p = Math.min(1, t / 1350);
    return { scale: (1 - p) ** 2, opacity: 1 - p, swirl: p * Math.PI * 3 };
  }
  if (state === "stopped") return { scale: 0, opacity: 0, swirl: 0 };
  if (state === "translating") return { scale: 0.12 + Math.sin(t / 220) * 0.015, opacity: 0.75, swirl: t / 650 };
  if (state === "speaking") {
    const p = Math.min(1, t / 650);
    const ease = 1 - (1 - p) ** 3;
    return { scale: 0.12 + ease * 1.08, opacity: 0.35 + ease * 0.65, swirl: -ease * Math.PI };
  }
  return { scale: state === "idle" ? 0.76 : state === "delivered" ? 0.88 : 1 + energy * 0.18, opacity: 1, swirl: 0 };
}

const TAU = Math.PI * 2;

export default function VoiceRouterCore({
  state,
  signal,
  sourceLabel,
  targetLabel,
  phaseLabel,
  waitingLabel = "声を待っています",
  quietLabel = "もう少し近くで話してください",
  heardLabel = "声が届いています",
  levelLabel = "声の強さ",
  variant = "compact",
}: Props) {
  const shell = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const assistHint = useRef<HTMLElement>(null);
  const assistMeter = useRef<HTMLSpanElement>(null);

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
    const fieldStrands: FieldStrand[] = Array.from({ length: 520 }, (_, index) => ({
      phase: (index * 2.399963229728653) % TAU,
      fold: 0.74 + ((index * 37) % 101) / 210,
      depth: ((index * 53) % 97) / 97,
      color: index % 4,
    }));
    // The attached anamorphosis assembles scattered particles into one readable
    // form only at the useful viewpoint. Here they assemble into a microphone
    // while we are waiting for speech, then loosen back into the voice field.
    const assistMotes: AssistMote[] = Array.from({ length: 104 }, (_, index) => {
      let homeX = 0;
      let homeY = 0;
      if (index < 60) {
        const angle = index / 60 * TAU;
        homeX = Math.cos(angle) * 0.16;
        homeY = Math.sin(angle) * 0.25 - 0.08;
      } else if (index < 82) {
        const progress = (index - 60) / 21;
        const side = index % 2 ? -1 : 1;
        homeX = side * (0.25 - progress * 0.25);
        homeY = -0.02 + progress * 0.34;
      } else if (index < 92) {
        const progress = (index - 82) / 9;
        homeY = 0.28 + progress * 0.15;
      } else {
        const progress = (index - 92) / 11;
        homeX = (progress - 0.5) * 0.38;
        homeY = 0.43;
      }
      return {
        homeX,
        homeY,
        scatterX: Math.sin(index * 12.9898) * (0.34 + (index % 7) * 0.055),
        scatterY: Math.cos(index * 7.233) * (0.25 + (index % 5) * 0.06),
        phase: (index * 2.399963229728653) % TAU,
      };
    });
    let width = 1;
    let height = 1;
    let frame = 0;
    let start = performance.now();
    let energy = 0;
    let low = 0;
    let mid = 0;
    let high = 0;
    let visible = !document.hidden;
    let lastLandscapeFrame = 0;
    let lastAssistCopy = "";

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
    const handleVisibility = () => {
      visible = !document.hidden;
      if (visible && !frame && !reduced) frame = requestAnimationFrame(draw);
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const palette = () => {
      if (state === "listening") return { main: "95,212,255", hot: "219,248,255" };
      if (state === "ending") return { main: "255,174,72", hot: "255,238,191" };
      if (state === "stopped") return { main: "95,227,154", hot: "226,255,236" };
      if (state === "translating") return { main: "226,178,255", hot: "255,235,187" };
      if (state === "speaking") return { main: "255,119,198", hot: "206,255,246" };
      if (state === "delivered") return { main: "95,227,154", hot: "232,255,220" };
      return { main: "232,201,106", hot: "255,242,194" };
    };

    const accentColors = () => {
      if (state === "listening") return ["95,212,255", "86,239,207", "194,135,255", "255,126,190"];
      if (state === "translating") return ["226,178,255", "255,196,104", "92,224,255", "255,111,188"];
      if (state === "speaking") return ["255,119,198", "106,224,255", "116,242,190", "255,209,103"];
      if (state === "delivered" || state === "stopped") return ["95,227,154", "106,224,255", "234,163,255", "255,211,111"];
      return ["232,201,106", "96,205,230", "180,128,236", "232,116,174"];
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

    const drawLandscapeField = (
      now: number,
      elapsed: number,
      main: string,
      hot: string,
      accents: string[],
      centerX: number,
      centerY: number,
      energy: number,
      low: number,
      mid: number,
      high: number,
    ) => {
      const t = now * 0.001;
      const base = Math.min(width * 0.31, height * 1.04);
      const pace = state === "translating" ? 1.75 : state === "speaking" ? -1.35 : 0.58 + energy * 1.8;
      const motion = voiceMotion(state, elapsed, signal.current.level);
      if (canvas.current) canvas.current.style.opacity = String(motion.opacity);
      const formScale = motion.scale;
      const juliaStrength = state === "translating"
        ? 0.34
        : state === "speaking"
          ? 0.18
          : state === "listening"
            ? 0.07 + energy * 0.2
            : 0.045;
      const speakingStretch = state === "speaking" ? 1.2 : 1;
      const rotY = t * 0.16 * pace;
      const rotX = -0.46 + Math.sin(t * 0.31) * 0.11;
      const rotZ = Math.sin(t * 0.19) * 0.08 + motion.swirl;
      const cy = Math.cos(rotY), sy = Math.sin(rotY);
      const cx = Math.cos(rotX), sx = Math.sin(rotX);
      const cz = Math.cos(rotZ), sz = Math.sin(rotZ);
      const density = width < 680 ? 270 : 520;
      const points = width < 680 ? 38 : 52;
      const pump = formScale * (1 + low * 0.23 + energy * 0.15);

      context.save();
      context.globalCompositeOperation = "screen";
      context.lineCap = "round";
      for (let strandIndex = 0; strandIndex < density; strandIndex++) {
        const strand = fieldStrands[strandIndex];
        const color = accents[strand.color];
        let nearest = -2;
        context.beginPath();
        for (let point = 0; point <= points; point++) {
          const theta = point / points * TAU;
          // A real Julia-style z²+c iteration supplies continuous, related
          // surprises instead of a collection of unrelated canned animations.
          let jr = Math.cos(theta) * (0.66 + strand.depth * 0.16);
          let ji = Math.sin(theta * 2 + strand.phase) * (0.42 + strand.fold * 0.1);
          const cr = -0.72 + Math.sin(t * 0.11) * 0.055;
          const ci = 0.22 + Math.cos(t * 0.09) * 0.065;
          for (let iteration = 0; iteration < 3; iteration++) {
            const nextR = jr * jr - ji * ji + cr;
            ji = Math.max(-2, Math.min(2, 2 * jr * ji + ci));
            jr = Math.max(-2, Math.min(2, nextR));
          }
          const juliaFold = Math.sin((jr + ji) * 2.7 + strand.phase + t * 0.17);
          const phi = strand.phase
            + Math.sin(theta * 2 + t * 0.34 + strand.fold * 3) * (0.36 + mid * 0.72)
            + Math.sin(theta * 5 - t * 0.22) * (0.08 + high * 0.2)
            + juliaFold * juliaStrength;
          // The shared silhouette deliberately avoids a perfect torus: three broad
          // folds and five smaller bends keep the field asymmetrical and alive.
          const silhouette = 1
            + Math.sin(theta * 3 + t * 0.13 + 0.65) * (0.14 + mid * 0.05)
            + Math.sin(theta * 5 - t * 0.09 - 1.1) * (0.075 + high * 0.035);
          const major = base * (0.58 * silhouette + Math.sin(theta * 3 + strand.phase) * (0.045 + mid * 0.05));
          const tube = base * (0.255 + strand.depth * 0.13 + energy * 0.075 + Math.abs(juliaFold) * juliaStrength * 0.08) * strand.fold;
          let x = (major + tube * Math.cos(phi)) * Math.cos(theta);
          let y = tube * Math.sin(phi) * 0.9;
          let z = (major + tube * Math.cos(phi)) * Math.sin(theta);
          x += Math.sin(theta * 2 + 0.8) * base * (0.1 + mid * 0.06);
          x += Math.sin(theta * 3 + strand.phase * 1.7 + t * 0.42) * base * (0.055 + mid * 0.08);
          y += Math.sin(theta * 3 - 0.45) * base * (0.13 + low * 0.08);
          y += Math.sin(theta * 2 - strand.phase + t * 0.28) * base * (0.075 + low * 0.09);
          z += Math.cos(theta * 4 + strand.phase - t * 0.36) * base * (0.055 + high * 0.1);
          x *= pump * speakingStretch;
          y *= pump;
          z *= pump;

          const x1 = x * cy - z * sy;
          const z1 = x * sy + z * cy;
          const y2 = y * cx - z1 * sx;
          const z2 = y * sx + z1 * cx;
          const x3 = x1 * cz - y2 * sz;
          const y3 = x1 * sz + y2 * cz;
          const perspective = 1.18 / (1.18 + z2 / (base * 3.2));
          const px = centerX + x3 * perspective;
          const py = centerY + y3 * perspective;
          nearest = Math.max(nearest, z2 / base);
          if (point === 0) context.moveTo(px, py);
          else context.lineTo(px, py);
        }
        const front = Math.max(0, Math.min(1, (nearest + 1.25) / 2.5));
        context.strokeStyle = `rgba(${color},${0.022 + front * 0.12 + energy * 0.08})`;
        context.lineWidth = 0.28 + front * 0.72 + (strandIndex % 41 === 0 ? 0.5 : 0);
        context.stroke();
      }

      if (state === "listening") {
        const measured = Math.min(1, Math.max(0, signal.current.level * 3.2));
        const assemble = Math.max(0.08, 1 - measured * 1.35);
        context.save();
        context.globalCompositeOperation = "screen";
        for (let index = 0; index < assistMotes.length; index++) {
          const mote = assistMotes[index];
          const flutter = 0.025 + measured * 0.16;
          const homeX = mote.homeX * base * 0.72;
          const homeY = mote.homeY * base * 0.72;
          const looseX = mote.scatterX * base + Math.sin(t * 2.2 + mote.phase) * base * flutter;
          const looseY = mote.scatterY * base + Math.cos(t * 1.8 + mote.phase) * base * flutter;
          const x = centerX + homeX * assemble + looseX * (1 - assemble);
          const y = centerY + homeY * assemble + looseY * (1 - assemble);
          const size = 0.7 + (index % 4) * 0.28 + measured * 1.5;
          context.fillStyle = `rgba(${index % 3 === 0 ? hot : main},${0.18 + assemble * 0.5 + measured * 0.18})`;
          context.shadowColor = `rgba(${main},0.8)`;
          context.shadowBlur = 4 + measured * 12;
          context.beginPath();
          context.arc(x, y, size, 0, TAU);
          context.fill();
        }
        context.restore();
      }

      for (let index = 0; index < 9; index++) {
        const progress = (elapsed * (state === "translating" ? 0.00048 : state === "speaking" ? 0.00036 : 0.00016) + index / 9) % 1;
        const angle = progress * TAU;
        const orbit = base * (0.64 + Math.sin(angle * 3 + t) * 0.12);
        const x = centerX + Math.cos(angle + rotY) * orbit;
        const y = centerY + Math.sin(angle * 2 + rotX) * base * 0.23;
        const glow = context.createRadialGradient(x, y, 0, x, y, 8 + energy * 10);
        glow.addColorStop(0, `rgba(${index % 3 === 0 ? hot : main},${0.45 + energy * 0.4})`);
        glow.addColorStop(1, `rgba(${main},0)`);
        context.fillStyle = glow;
        context.fillRect(x - 18, y - 18, 36, 36);
      }
      context.restore();
    };

    const draw = (now: number) => {
      frame = 0;
      if (variant === "landscape" && !visible) return;
      if (variant === "landscape" && now - lastLandscapeFrame < 31 && !reduced) {
        frame = requestAnimationFrame(draw);
        return;
      }
      if (variant === "landscape") lastLandscapeFrame = now;
      const elapsed = now - start;
      const live = signal.current;
      const active = state === "listening";
      const idleBreath = 0.035 + (Math.sin(now * 0.0017) + 1) * 0.018;
      const closing = state === "ending" ? Math.min(1, elapsed / 1350) : 0;
      const targetEnergy = active ? Math.max(live.level, idleBreath) : state === "ending" ? 0.2 * (1 - closing) : state === "stopped" ? 0.015 : state === "translating" ? 0.32 : state === "speaking" ? 0.24 : state === "delivered" ? 0.13 : idleBreath;
      energy += (targetEnergy - energy) * 0.16;
      low += ((active ? live.low : idleBreath * 0.7) - low) * 0.13;
      mid += ((active ? live.mid : idleBreath) - mid) * 0.13;
      high += ((active ? live.high : idleBreath * 0.55) - high) * 0.13;
      const { main, hot } = palette();
      const accents = accentColors();
      const centerX = width / 2;
      const centerY = height / 2;
      if (variant === "landscape") {
        const measuredLevel = state === "listening" ? Math.min(1, live.level * 3.2) : 0;
        const inputState = state !== "listening"
          ? state
          : measuredLevel >= 0.12
            ? "heard"
            : elapsed > 1400
              ? "quiet"
              : "waiting";
        const assistCopy = inputState === "heard"
          ? heardLabel
          : inputState === "quiet"
            ? quietLabel
            : inputState === "waiting"
              ? waitingLabel
              : phaseLabel;
        host.dataset.input = inputState;
        assistMeter.current?.style.setProperty("--voice-level", measuredLevel.toFixed(3));
        if (assistHint.current && assistCopy !== lastAssistCopy) {
          assistHint.current.textContent = assistCopy;
          lastAssistCopy = assistCopy;
        }
      }
      const coreRadius = variant === "landscape"
        ? Math.min(180, Math.max(72, Math.min(width * 0.25, height * 0.42)))
        : Math.min(40, Math.max(25, height * 0.34));

      context.clearRect(0, 0, width, height);

      const glow = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(width * 0.33, 120));
      glow.addColorStop(0, `rgba(${main},${0.28 + energy * 0.24})`);
      glow.addColorStop(0.35, `rgba(${main},${0.09 + energy * 0.12})`);
      glow.addColorStop(1, `rgba(${main},0)`);
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      for (const particle of particles) {
        const pace = state === "translating" ? 4.2 : state === "speaking" ? 2.8 : active ? 1.4 + energy * 4 : 1;
        const x = ((particle.x + now * particle.speed * pace) % 1) * width;
        const wave = Math.sin(now * 0.0014 + particle.phase) * (3 + energy * 10);
        const y = centerY + particle.lane * height * 0.22 + wave;
        const distance = Math.abs(x - centerX) / Math.max(1, width / 2);
        const alpha = (0.18 + energy * 0.3) * (1 - distance * 0.45);
        context.fillStyle = `rgba(${main},${alpha})`;
        context.fillRect(x, y, particle.size + energy * 1.8, particle.size + energy * 1.8);
      }

      if (variant === "landscape") {
        drawLandscapeField(now, elapsed, main, hot, accents, centerX, centerY, energy, low, mid, high);
        if (state === "ending") {
          const countdownRadius = Math.max(5, Math.min(height * 0.42, 82) * (1 - closing * 0.9));
          context.beginPath();
          context.arc(centerX, centerY, countdownRadius, 0, TAU);
          context.strokeStyle = `rgba(${main},${0.95 - closing * 0.24})`;
          context.lineWidth = 4 + closing * 3;
          context.shadowColor = `rgba(${main},0.9)`;
          context.shadowBlur = 20;
          context.stroke();
          context.shadowBlur = 0;
        }
        if (!reduced && visible) frame = requestAnimationFrame(draw);
        return;
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

      if (state === "translating" || state === "speaking" || state === "delivered") {
        const packetCount = state === "translating" ? 7 : state === "speaking" ? 6 : 3;
        for (let index = 0; index < packetCount; index++) {
          const progress = ((elapsed * (state === "translating" ? 0.00055 : state === "speaking" ? 0.00042 : 0.00028) + index / packetCount) % 1);
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

      const lobes = state === "translating" ? 10 : state === "speaking" ? 9 : state === "delivered" ? 8 : 7;
      const closeScale = state === "ending" ? 1 - closing * 0.48 : state === "stopped" ? 0.52 : 1;
      const radius = coreRadius * closeScale * (1 + energy * 0.34 + Math.min(0.16, live.peak * 0.14));
      // A woven, asymmetric voice form: the signal bends colored strands instead
      // of inflating another circular status lamp.
      context.save();
      context.globalCompositeOperation = "screen";
      for (let strand = 0; strand < 9; strand++) {
        const color = accents[strand % accents.length];
        const strandPhase = strand * 0.71 + now * (0.00018 + high * 0.0011);
        context.beginPath();
        for (let index = 0; index <= 72; index++) {
          const angle = index / 72 * TAU;
          const fold = Math.sin(angle * lobes + strandPhase) * (3 + mid * 11);
          const warp = Math.sin(angle * 3 - now * 0.0007 + strand) * (4 + low * 12);
          const r = radius * (0.66 + strand * 0.055) + fold;
          const x = centerX + Math.cos(angle) * r + Math.sin(angle * 2 + strandPhase) * (5 + energy * 13);
          const y = centerY + Math.sin(angle) * r * (0.48 + strand * 0.025) + warp * 0.42;
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.strokeStyle = `rgba(${color},${0.24 + energy * 0.58})`;
        context.lineWidth = strand % 3 === 0 ? 1.7 : 0.8;
        context.shadowColor = `rgba(${color},0.9)`;
        context.shadowBlur = 7 + energy * 22;
        context.stroke();
      }
      context.restore();

      context.beginPath();
      for (let index = 0; index <= 12; index++) {
        const angle = index / 12 * TAU;
        const crystal = radius * (index % 2 === 0 ? 0.32 : 0.18) * (1 + energy * 0.42);
        const x = centerX + Math.cos(angle) * crystal;
        const y = centerY + Math.sin(angle) * crystal * 0.66;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.closePath();
      const core = context.createLinearGradient(centerX - radius, centerY, centerX + radius, centerY);
      core.addColorStop(0, `rgba(${accents[1]},${0.2 + energy * 0.28})`);
      core.addColorStop(0.48, "rgba(8,8,7,0.94)");
      core.addColorStop(1, `rgba(${accents[3]},${0.2 + energy * 0.3})`);
      context.fillStyle = core;
      context.fill();
      context.strokeStyle = `rgba(${hot},${0.52 + energy * 0.36})`;
      context.lineWidth = 0.9;
      context.stroke();

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
      document.removeEventListener("visibilitychange", handleVisibility);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [heardLabel, phaseLabel, quietLabel, signal, state, variant, waitingLabel]);

  return (
    <div ref={shell} className={`voice-router-core voice-router-core--${variant}`} data-state={state} aria-label={`${sourceLabel}から${targetLabel}へ、${phaseLabel}`}>
      {variant === "landscape" && <VoiceGarden state={state} signal={signal} />}
      <canvas ref={canvas} aria-hidden="true" />
      <div className="voice-router-readout" aria-hidden="true">
        <span>{sourceLabel}</span>
        <strong>{phaseLabel}</strong>
        <span>{targetLabel}</span>
      </div>
      {variant === "landscape" && (
        <div className="voice-router-assist" aria-live="polite">
          <span className="voice-router-level-label">{levelLabel}</span>
          <span ref={assistMeter} className="voice-router-level" aria-hidden="true">
            {Array.from({ length: 10 }, (_, index) => <i key={index} />)}
          </span>
          <b ref={assistHint}>{phaseLabel}</b>
        </div>
      )}
    </div>
  );
}
