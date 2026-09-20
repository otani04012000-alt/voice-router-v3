'use client'

// @ts-nocheck
/* eslint-disable @typescript-eslint/ban-ts-comment, react-hooks/exhaustive-deps */
import React, { useRef, useMemo, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Html, Line } from '@react-three/drei'
import * as THREE from 'three'

const VALLEY_ZOOM_MAX = 1e7
const VALLEY_Z_START = 16.0
const VALLEY_Z_END = 0.6

const valleyVertexShader = `
  varying vec2 vUv;
  varying float vFogDepth;
  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vFogDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`

const valleyFragmentShader = `
  precision highp float;
  uniform float uTime;
  uniform float uZoom;
  uniform vec2 uCenter;
  uniform vec2 uResolution;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  varying vec2 vUv;
  varying float vFogDepth;

  void main() {
    vec2 uv = (vUv - 0.5) * 2.0;
    uv.x *= uResolution.x / uResolution.y;

    float scale = 1.0 / uZoom;
    vec2 c = uCenter + uv * scale;

    vec2 z = vec2(0.0);
    float iter = 0.0;
    const float MAX_ITER = 260.0;

    for (float i = 0.0; i < MAX_ITER; i++) {
      if (dot(z, z) > 256.0) break;
      z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;
      iter += 1.0;
    }

    vec3 col;
    if (iter >= MAX_ITER) {
      col = vec3(0.02, 0.05, 0.035);
    } else {
      float logZn = log(dot(z, z)) / 2.0;
      float nu = log(logZn / log(2.0)) / log(2.0);
      float smoothIter = iter + 1.0 - nu;
      float t = fract(smoothIter / MAX_ITER * 6.0 + uTime * 0.015);

      vec3 amber  = vec3(0.784, 0.663, 0.431);
      vec3 bark   = vec3(0.353, 0.290, 0.157);
      vec3 forest = vec3(0.122, 0.180, 0.133);
      vec3 indigo = vec3(0.086, 0.114, 0.200);

      if (t < 0.33) col = mix(indigo, forest, t / 0.33);
      else if (t < 0.66) col = mix(forest, bark, (t - 0.33) / 0.33);
      else col = mix(bark, amber, (t - 0.66) / 0.34);

      float depthFade = smoothstep(0.0, 40.0, smoothIter);
      col *= 0.35 + depthFade * 0.9;
    }

    float fogFactor = clamp(1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth), 0.0, 1.0);
    col = mix(col, uFogColor, fogFactor * 0.6);

    gl_FragColor = vec4(col, 1.0);
  }
`

function BackgroundValley() {
  const meshRef = useRef(null)
  const materialRef = useRef(null)
  const initialSize =
    typeof window !== 'undefined'
      ? { width: window.innerWidth, height: window.innerHeight }
      : { width: 1280, height: 720 }

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uZoom: { value: 1.0 },
      uCenter: { value: new THREE.Vector2(-0.743643887037, 0.131825904205) },
      uResolution: { value: new THREE.Vector2(initialSize.width, initialSize.height) },
      uFogColor: { value: new THREE.Color('#0a1c15') },
      uFogDensity: { value: 0.05 },
    }),
    [],
  )

  useFrame((state) => {
    const cameraZ = state.camera.position.z
    const depth = THREE.MathUtils.clamp(
      (VALLEY_Z_START - cameraZ) / (VALLEY_Z_START - VALLEY_Z_END),
      0.0,
      1.0,
    )
    const zoom = Math.pow(VALLEY_ZOOM_MAX, depth)

    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime
      materialRef.current.uniforms.uZoom.value = zoom
      materialRef.current.uniforms.uResolution.value.set(state.size.width, state.size.height)
    }

    if (meshRef.current) {
      meshRef.current.position.copy(state.camera.position)
      meshRef.current.quaternion.copy(state.camera.quaternion)
      meshRef.current.translateZ(-200)
    }
  })

  return (
    <mesh ref={meshRef} renderOrder={-2}>
      <planeGeometry args={[1000, 1000]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={valleyVertexShader}
        fragmentShader={valleyFragmentShader}
        uniforms={uniforms}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  )
}

function MidgroundParticles({ count = 700 }: { count?: number }) {
  const pointsRef = useRef(null)

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = 6 + Math.random() * 34
      const theta = Math.random() * Math.PI * 2
      pos[i * 3] = Math.cos(theta) * r
      pos[i * 3 + 1] = (Math.random() - 0.5) * 26
      pos[i * 3 + 2] = Math.sin(theta) * r - 8
    }
    return pos
  }, [count])

  useFrame((state) => {
    if (!pointsRef.current) return
    const t = state.clock.elapsedTime
    pointsRef.current.rotation.y = t * 0.04
    pointsRef.current.position.z = state.camera.position.z * 0.3
  })

  return (
    <points ref={pointsRef} renderOrder={-1}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.14}
        color="#c8a96e"
        transparent
        opacity={0.55}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

function SynapseCore({ nodeCount }: { nodeCount: number }) {
  const ref = useRef(null)
  const glow = useRef(null)
  useFrame((state, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.15
    if (glow.current) {
      const s = 1 + Math.sin(state.clock.elapsedTime * 1.2) * 0.04
      glow.current.scale.set(s, s, s)
    }
  })
  const coreScale = Math.min(1.3, 0.75 + nodeCount * 0.03)
  return (
    <>
      <mesh ref={ref} scale={coreScale} renderOrder={1}>
        <sphereGeometry args={[0.75, 64, 64]} />
        <meshStandardMaterial
          color="#c8a96e"
          emissive="#5a4a28"
          emissiveIntensity={1.0}
          metalness={0.6}
          roughness={0.3}
        />
      </mesh>
      <mesh ref={glow} scale={coreScale} renderOrder={1}>
        <sphereGeometry args={[0.95, 32, 32]} />
        <meshBasicMaterial color="#c8a96e" transparent opacity={0.08} />
      </mesh>
    </>
  )
}

function FileNode({
  position,
  fileName,
  words,
  color,
  strength,
  index,
  onClick,
}: {
  position: [number, number, number]
  fileName: string
  words: string[]
  color: string
  strength: number
  index: number
  onClick?: () => void
}) {
  const ref = useRef(null)
  const [hover, setHover] = useState(false)
  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime
    ref.current.position.y = position[1] + Math.sin(t * 0.6 + index) * 0.18
    ref.current.position.x = position[0] + Math.cos(t * 0.4 + index) * 0.08
    const pulse = 0.7 + strength * 0.5 + (hover ? 0.15 : 0)
    ref.current.scale.set(pulse, pulse, pulse)
  })
  const intensity = 0.6 + strength * 1.4 + (hover ? 0.4 : 0)
  return (
    <group position={position}>
      <mesh
        ref={ref}
        renderOrder={1}
        onPointerOver={(e: any) => {
          e.stopPropagation()
          setHover(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHover(false)
          document.body.style.cursor = 'auto'
        }}
        onClick={(e: any) => {
          e.stopPropagation()
          onClick?.()
        }}
      >
        <sphereGeometry args={[0.28, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={intensity}
          metalness={0.4}
          roughness={0.35}
        />
      </mesh>
      <Html position={[0, 0.55, 0]} center distanceFactor={8} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            fontFamily: "'Noto Serif JP', serif",
            fontSize: '0.78rem',
            fontWeight: 600,
            color: '#f4f1e6',
            background: `linear-gradient(135deg, ${color}2e, rgba(20,20,24,0.55))`,
            border: `1px solid ${color}88`,
            borderRadius: 999,
            padding: '7px 16px',
            whiteSpace: 'nowrap',
            backdropFilter: 'blur(6px)',
            textShadow: '0 1px 3px rgba(0,0,0,0.6)',
            boxShadow: `0 0 18px ${color}40, inset 0 0 12px ${color}22`,
            maxWidth: 200,
          }}
        >
          <div>{fileName}</div>
          {words.length > 0 && (
            <div style={{ opacity: 0.7, fontSize: '0.62rem', fontWeight: 400, marginTop: 2 }}>
              {words.slice(0, 3).join(' · ')}
            </div>
          )}
        </div>
      </Html>
    </group>
  )
}

function SynapseLink({
  to,
  color,
  strength,
}: {
  to: [number, number, number]
  color: string
  strength: number
}) {
  const ref = useRef(null)
  useFrame((state) => {
    if (!ref.current || !ref.current.material) return
    const t = state.clock.elapsedTime
    const base = 0.25 + strength * 0.4
    ref.current.material.opacity = base + Math.sin(t * (2 + strength * 3) + to[0]) * 0.15
  })
  return (
    <Line
      ref={ref}
      points={[[0, 0, 0], to]}
      color={color}
      lineWidth={0.8 + strength * 1.8}
      transparent
      opacity={0.4}
      renderOrder={1}
    />
  )
}

function SynapseGraph({
  nodes,
  onSelect,
}: {
  nodes: { id: string; fileName: string; words: string[]; color: string; strength: number }[]
  onSelect?: (id: string) => void
}) {
  const positions = useMemo(() => {
    const n = nodes.length
    return nodes.map((_, i) => {
      const goldenAngle = Math.PI * (3 - Math.sqrt(5))
      const y = n > 1 ? 1 - (i / (n - 1)) * 2 : 0
      const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y))
      const theta = goldenAngle * i
      const r = 2.6 + (n > 12 ? Math.min(1.5, (n - 12) * 0.08) : 0)
      return [
        Math.cos(theta) * radiusAtY * r,
        y * r,
        Math.sin(theta) * radiusAtY * r,
      ] as [number, number, number]
    })
  }, [nodes.length])

  return (
    <>
      <SynapseCore nodeCount={nodes.length} />
      {nodes.map((n, i) => (
        <FileNode
          key={n.id}
          position={positions[i]}
          fileName={n.fileName}
          words={n.words}
          color={n.color}
          strength={n.strength}
          index={i}
          onClick={() => onSelect?.(n.id)}
        />
      ))}
      {nodes.map((n, i) => (
        <SynapseLink key={`link-${n.id}`} to={positions[i]} color={n.color} strength={n.strength} />
      ))}
    </>
  )
}

export default function SynapseSphere({
  nodes,
  onSelect,
}: {
  nodes: { id: string; fileName: string; words: string[]; color: string; strength: number }[]
  onSelect?: (id: string) => void
}) {
  return (
    <div
      style={{
        width: '100%',
        height: '70vh',
        position: 'relative',
        background:
          'radial-gradient(circle at 18% 25%, rgba(255,90,60,0.16), transparent 42%), ' +
          'radial-gradient(circle at 78% 30%, rgba(60,200,140,0.15), transparent 45%), ' +
          'radial-gradient(circle at 50% 75%, rgba(140,90,220,0.16), transparent 48%), ' +
          'radial-gradient(circle at 85% 80%, rgba(60,140,230,0.13), transparent 45%), ' +
          '#05070a',
      }}
    >
      <Canvas camera={{ position: [0, 0, 9], fov: 55, near: 0.05, far: 2000 }} style={{ width: '100%', height: '100%' }}>
        <ambientLight intensity={0.4} />
        <pointLight position={[6, 6, 6]} intensity={1.4} color="#ff8a5c" />
        <pointLight position={[-6, -4, -2]} intensity={1.1} color="#5cd6a0" />
        <pointLight position={[0, -3, 4]} intensity={1.0} color="#a06cf0" />
        <pointLight position={[0, 0, 3]} intensity={0.7} color="#ffffff" />
        <Stars radius={60} depth={30} count={2200} factor={3.2} fade speed={0.4} />

        <BackgroundValley />
        <MidgroundParticles count={700} />
        <SynapseGraph nodes={nodes} onSelect={onSelect} />

        <OrbitControls
          enablePan={false}
          enableZoom
          rotateSpeed={0.55}
          zoomSpeed={0.5}
          minDistance={0.6}
          maxDistance={16}
          autoRotate
          autoRotateSpeed={0.35}
          target={[0, 0, 0]}
        />
      </Canvas>
    </div>
  )
}
