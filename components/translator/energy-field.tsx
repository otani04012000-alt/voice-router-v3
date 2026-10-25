"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { VoiceSignal } from "./use-voice";
import type { RouterVisualState } from "./voice-router-core";

type Props = { state: RouterVisualState; signal: RefObject<VoiceSignal> };
type Node = { x: number; y: number; phase: number };
type Edge = { from: number; to: number; distance: number };
const TAU = Math.PI * 2;
const FRAME_MS = 1000 / 15;

export default function EnergyField({ state, signal }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const wrapper = host.current, element = canvas.current;
    const parent = wrapper?.parentElement, context = element?.getContext("2d");
    if (!wrapper || !element || !parent || !context) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let width = 1, height = 1, frame = 0, energy = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let last: number | null = null, visible = false, disposed = false;
    let nodes: Node[] = [], edges: Edge[] = [];
    const pause = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      last = null;
    };
    const wake = () => {
      if (!disposed && visible && !document.hidden && !frame && timer === null)
        frame = requestAnimationFrame(draw);
    };
    const resize = () => {
      const bounds = parent.getBoundingClientRect();
      const ratio = Math.min(devicePixelRatio || 1, 1.35);
      width = Math.max(1, bounds.width); height = Math.max(1, bounds.height);
      element.width = Math.round(width * ratio); element.height = Math.round(height * ratio);
      element.style.width = `${width}px`; element.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const columns = Math.max(5, Math.ceil(width / 120));
      const rows = Math.max(9, Math.min(24, Math.ceil(height / 115)));
      nodes = Array.from({ length: columns * rows }, (_, index) => ({
        x: ((index % columns) / Math.max(1, columns - 1)) * width + Math.sin(index * 12.9898) * 22,
        y: (Math.floor(index / columns) / Math.max(1, rows - 1)) * height + Math.cos(index * 7.233) * 20,
        phase: (index * 2.399963) % TAU,
      }));
      edges = nodes.flatMap((from, fromIndex) => nodes.map((to, toIndex) => ({
        from: fromIndex, to: toIndex, distance: Math.hypot(to.x - from.x, to.y - from.y),
      })).filter(({ to, distance }) => to > fromIndex && distance <= 205)
        .sort((a, b) => a.distance - b.distance).slice(0, 3));
      wake();
    };
    function draw(now: number) {
      frame = 0;
      if (disposed || document.hidden || !visible) return;
      const elapsed = last === null ? FRAME_MS : Math.max(0, now - last);
      last = now;
      const target = state === "listening" ? Math.max(0.18, signal.current.level) : state === "translating" ? 0.72 : state === "speaking" ? 0.58 : state === "delivered" ? 0.38 : 0.18;
      energy += (target - energy) * -Math.expm1(-elapsed / 295);
      const time = motion.matches ? 0 : now / 1000;
      const cyan = state === "listening" || state === "speaking";
      const line = cyan ? "118,207,230" : "210,177,91";
      const hot = cyan ? "225,249,255" : "255,238,184";
      context!.clearRect(0, 0, width, height);
      const positions = nodes.map(node => ({
        x: node.x + Math.sin(time * 0.16 + node.phase) * (8 + energy * 13),
        y: node.y + Math.cos(time * 0.13 + node.phase * 0.7) * (7 + energy * 11),
      }));
      for (const edge of edges) {
        const from = positions[edge.from], to = positions[edge.to];
        const alpha = (1 - edge.distance / 230) * (0.11 + energy * 0.13);
        context!.beginPath(); context!.moveTo(from.x, from.y); context!.lineTo(to.x, to.y);
        context!.strokeStyle = `rgba(${line},${alpha})`; context!.lineWidth = 0.65; context!.stroke();
      }
      for (let index = 0; index < positions.length; index += 4) {
        const from = positions[index], next = positions[Math.min(positions.length - 1, index + 1)];
        const pulse = (time * (0.12 + energy * 0.1) + index * 0.071) % 1;
        context!.beginPath();
        context!.arc(from.x + (next.x - from.x) * pulse, from.y + (next.y - from.y) * pulse, 1.2 + energy, 0, TAU);
        context!.fillStyle = `rgba(${hot},${0.34 + energy * 0.42})`;
        context!.shadowColor = `rgba(${hot},0.8)`; context!.shadowBlur = 9;
        context!.fill(); context!.shadowBlur = 0;
      }
      if (!disposed && visible && !document.hidden)
        timer = setTimeout(() => { timer = null; wake(); }, FRAME_MS);
    }
    const visibility = () => { if (document.hidden) pause(); else wake(); };
    const observer = new ResizeObserver(resize);
    const intersection = new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? false;
      if (visible) wake(); else pause();
    });
    observer.observe(parent); intersection.observe(wrapper);
    document.addEventListener("visibilitychange", visibility);
    resize();
    return () => {
      disposed = true; pause(); observer.disconnect(); intersection.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [signal, state]);
  return <div ref={host} className="energy-field" aria-hidden="true"><canvas ref={canvas} /></div>;
}
