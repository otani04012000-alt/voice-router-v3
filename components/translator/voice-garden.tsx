"use client";

import { useEffect, useRef } from "react";

type VoiceGardenProps = {
  state: string;
  signal: { current: { level: number } };
  phaseLabel: string;
};

const VERTEX_SHADER = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `
precision highp float;

uniform vec2 resolution;
uniform float time;
uniform float audio;
uniform float collapse;

mat2 rotate2d(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c);
}

float gyroidPattern(vec3 p, float scale) {
  vec3 q = p * scale;
  return abs(dot(sin(q), cos(q.zxy)) - 0.2);
}

float displacement(vec3 p, float t) {
  vec3 pos = p;
  pos.xy *= rotate2d(t * (0.2 + audio * 0.22));
  pos.yz *= rotate2d(sin(t * 0.17) * 0.38);

  float d1 = sin(pos.x * 12.0 + sin(pos.y * 8.0 + t * 0.8))
    * cos(pos.z * 12.0 - t * 0.45);
  float d2 = sin(pos.y * 16.0 + sin(pos.z * 10.0 - t * 0.64))
    * cos(pos.x * 16.0 + t * 0.38);
  float d3 = sin((pos.x + pos.z) * 20.0 - t * 0.7)
    * cos(pos.y * 18.0 + t * 0.52);
  float g = gyroidPattern(pos + vec3(sin(t * 0.22) * 0.08), 8.0 + audio * 2.4);
  float grooves = (d1 + d2) * 0.037 + d3 * 0.015 - g * 0.046;
  return grooves * (1.0 + audio * 0.62);
}

float mapShape(vec3 p) {
  float visibleScale = max(0.035, 1.0 - collapse * 0.965);
  p /= visibleScale;
  p.xz *= rotate2d(time * 0.14 + collapse * 18.8496);
  p.xy *= rotate2d(sin(time * 0.19) * 0.2);

  float stretchX = 1.0 + audio * 0.34 + sin(time * 2.1) * audio * 0.1;
  float stretchY = 1.0 + audio * 0.2 + cos(time * 1.7) * audio * 0.08;
  vec3 shaped = p / vec3(stretchX, stretchY, 1.0 + audio * 0.1);
  float radius = 0.7 + audio * 0.085;
  float baseSphere = length(shaped) - radius;
  float disp = displacement(normalize(shaped) * radius, time);
  return (baseSphere + disp) * visibleScale;
}

vec3 calcNormal(vec3 p) {
  float eps = 0.0018;
  vec2 h = vec2(eps, 0.0);
  return normalize(vec3(
    mapShape(p + h.xyy) - mapShape(p - h.xyy),
    mapShape(p + h.yxy) - mapShape(p - h.yxy),
    mapShape(p + h.yyx) - mapShape(p - h.yyx)
  ));
}

vec3 renderShading(vec3 p, vec3 normal, vec3 rayDirection) {
  vec3 lightDirection = normalize(vec3(0.5, 1.0, 0.8));
  vec3 sideLight = normalize(vec3(-0.8, 0.25, 0.45));
  float diffuse = max(dot(normal, lightDirection), 0.0);
  float side = max(dot(normal, sideLight), 0.0);
  vec3 reflected = reflect(rayDirection, normal);
  float specular = pow(max(dot(reflected, lightDirection), 0.0), 36.0);
  float fresnel = pow(1.0 - max(dot(-rayDirection, normal), 0.0), 2.7);
  float ridge = smoothstep(0.16, 0.02, gyroidPattern(normal + p * 0.3, 9.0));

  vec3 deepBlue = vec3(0.035, 0.095, 0.15);
  vec3 slateBlue = vec3(0.18, 0.34, 0.48);
  vec3 baseColor = mix(deepBlue, slateBlue, diffuse * 0.8 + side * 0.26);
  vec3 color = baseColor * (0.38 + diffuse * 0.76 + side * 0.2);
  color += vec3(0.82, 0.94, 1.0) * specular * (0.72 + audio * 0.35);
  color += vec3(0.38, 0.68, 0.88) * fresnel * 0.72;
  color += vec3(0.85, 0.68, 0.3) * ridge * (0.07 + audio * 0.1);
  return color;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * resolution) / resolution.y;
  vec3 rayOrigin = vec3(0.0, 0.0, 2.65);
  vec3 rayDirection = normalize(vec3(uv, -1.75));
  float travel = 0.0;
  bool hit = false;
  vec3 position = rayOrigin;

  for (int step = 0; step < 82; step++) {
    position = rayOrigin + rayDirection * travel;
    float distance = mapShape(position);
    if (distance < 0.0018) {
      hit = true;
      break;
    }
    travel += max(0.0015, distance * 0.56);
    if (travel > 5.0) break;
  }

  if (!hit) {
    gl_FragColor = vec4(0.0);
    return;
  }

  vec3 normal = calcNormal(position);
  vec3 color = renderShading(position, normal, rayDirection);
  color = color / (vec3(1.0) + color * 0.24);
  float alpha = (0.92 + pow(1.0 - max(dot(-rayDirection, normal), 0.0), 2.0) * 0.08)
    * (1.0 - collapse);
  gl_FragColor = vec4(color, alpha);
}`;

export default function VoiceGarden({ state, signal, phaseLabel }: VoiceGardenProps) {
  const shaderRef = useRef<HTMLCanvasElement>(null);
  const effectsRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const shaderCanvas = shaderRef.current;
    const effectsCanvas = effectsRef.current;
    const context = effectsCanvas?.getContext("2d");
    if (!shaderCanvas || !effectsCanvas || !context) return;

    const gl = shaderCanvas.getContext("webgl", { alpha: true, antialias: false });
    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    const shaders: WebGLShader[] = [];

    if (gl) {
      const compile = (type: number, source: string) => {
        const shader = gl.createShader(type);
        if (!shader) throw new Error("shader allocation failed");
        shaders.push(shader);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          throw new Error(gl.getShaderInfoLog(shader) || "shader compilation failed");
        }
        return shader;
      };

      try {
        program = gl.createProgram();
        if (!program) throw new Error("program allocation failed");
        gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX_SHADER));
        gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("shader link failed");
        gl.useProgram(program);
        buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const position = gl.getAttribLocation(program, "position");
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      } catch (error) {
        console.warn("Organic voice shader fallback", error);
        if (program) gl.deleteProgram(program);
        program = null;
      }
    }

    const uniforms = gl && program ? {
      resolution: gl.getUniformLocation(program, "resolution"),
      time: gl.getUniformLocation(program, "time"),
      audio: gl.getUniformLocation(program, "audio"),
      collapse: gl.getUniformLocation(program, "collapse"),
    } : null;

    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let lastTime = performance.now();
    let previousState = stateRef.current;
    let stateStarted = lastTime;
    let audio = 0;

    const draw = (now: number) => {
      const bounds = effectsCanvas.getBoundingClientRect();
      const width = bounds.width;
      const height = bounds.height;
      const delta = Math.min(.05, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;

      if (stateRef.current !== previousState) {
        previousState = stateRef.current;
        stateStarted = now;
      }

      if (width < 1 || height < 1) {
        frame = requestAnimationFrame(draw);
        return;
      }

      const density = Math.min(devicePixelRatio || 1, 1.35);
      const pixelWidth = Math.round(width * density);
      const pixelHeight = Math.round(height * density);
      if (effectsCanvas.width !== pixelWidth || effectsCanvas.height !== pixelHeight) {
        effectsCanvas.width = shaderCanvas.width = pixelWidth;
        effectsCanvas.height = shaderCanvas.height = pixelHeight;
        context.setTransform(density, 0, 0, density, 0, 0);
        gl?.viewport(0, 0, pixelWidth, pixelHeight);
      }

      const isListening = stateRef.current === "listening";
      const isEnding = stateRef.current === "ending";
      const isStopped = stateRef.current === "stopped";
      const targetAudio = isListening && Number.isFinite(signal.current.level)
        ? Math.max(.035, Math.min(1, signal.current.level * 3.2))
        : 0;
      audio += (targetAudio - audio) * (1 - Math.exp(-delta * (targetAudio > audio ? 20 : 6)));

      const elapsed = now - stateStarted;
      const collapse = isEnding ? Math.min(1, elapsed / 1350) : isStopped ? 1 : 0;
      const shaderTime = reducedMotion ? 0 : now / 1000;

      if (gl && program && uniforms) {
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(program);
        gl.uniform2f(uniforms.resolution, pixelWidth, pixelHeight);
        gl.uniform1f(uniforms.time, shaderTime);
        gl.uniform1f(uniforms.audio, audio);
        gl.uniform1f(uniforms.collapse, collapse);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }

      context.clearRect(0, 0, width, height);
      const centerX = width / 2;
      const centerY = height / 2;
      const haloRadius = Math.min(width, height) * (.32 + audio * .16) * (1 - collapse * .88);
      const halo = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(8, haloRadius));
      halo.addColorStop(0, `rgba(118,204,235,${.12 + audio * .16})`);
      halo.addColorStop(.5, `rgba(69,139,171,${.065 + audio * .07})`);
      halo.addColorStop(1, "rgba(8,25,36,0)");
      context.fillStyle = halo;
      context.fillRect(0, 0, width, height);

      if (isListening) {
        const radius = Math.min(width, height) * (.17 + audio * .11);
        for (let ring = 0; ring < 3; ring += 1) {
          context.beginPath();
          context.arc(centerX, centerY, radius + ring * 12 + Math.sin(shaderTime * 5 + ring) * 4, 0, Math.PI * 2);
          context.strokeStyle = `rgba(${ring === 0 ? "229,249,255" : "114,205,236"},${.48 - ring * .11 + audio * .3})`;
          context.lineWidth = ring === 0 ? 2.3 : .85;
          context.stroke();
        }
      }

      if (isEnding) {
        const radius = Math.max(5, Math.min(width, height) * .25 * (1 - collapse * .94));
        context.beginPath();
        context.arc(centerX, centerY, radius, 0, Math.PI * 2);
        context.strokeStyle = `rgba(255,${Math.round(202 - collapse * 88)},${Math.round(106 - collapse * 52)},.96)`;
        context.lineWidth = 3 + collapse * 5;
        context.shadowColor = "rgba(255,139,70,.95)";
        context.shadowBlur = 18 + collapse * 30;
        context.stroke();
        context.beginPath();
        context.arc(centerX, centerY, radius + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - collapse));
        context.strokeStyle = `rgba(255,235,181,${1 - collapse * .35})`;
        context.lineWidth = 2.2;
        context.stroke();
        context.shadowBlur = 0;
      }

      if (!program && !isStopped) {
        const radius = Math.max(4, Math.min(width, height) * .23 * (1 - collapse));
        const fallback = context.createRadialGradient(centerX - radius * .25, centerY - radius * .28, 0, centerX, centerY, radius);
        fallback.addColorStop(0, "rgba(205,239,249,.8)");
        fallback.addColorStop(.45, "rgba(71,127,154,.78)");
        fallback.addColorStop(1, "rgba(12,41,58,0)");
        context.fillStyle = fallback;
        context.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
      }

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      if (gl) {
        if (buffer) gl.deleteBuffer(buffer);
        if (program) gl.deleteProgram(program);
        shaders.forEach((shader) => gl.deleteShader(shader));
      }
    };
  }, [signal]);

  return (
    <div className="voice-garden" aria-hidden="true">
      <canvas ref={shaderRef} />
      <canvas ref={effectsRef} />
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
