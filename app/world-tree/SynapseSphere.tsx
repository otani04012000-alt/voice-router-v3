'use client'

// @ts-nocheck
/* eslint-disable @typescript-eslint/ban-ts-comment, react-hooks/exhaustive-deps */
import React, { useRef, useMemo, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Html, Line } from '@react-three/drei'

// ─── 中心のコア球体：脈動しながら回転する ──────────────
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
      <mesh ref={ref} scale={coreScale}>
        <sphereGeometry args={[0.75, 64, 64]} />
        <meshStandardMaterial
          color="#c8a96e"
          emissive="#5a4a28"
          emissiveIntensity={1.0}
          metalness={0.6}
          roughness={0.3}
        />
      </mesh>
      <mesh ref={glow} scale={coreScale}>
        <sphereGeometry args={[0.95, 32, 32]} />
        <meshBasicMaterial color="#c8a96e" transparent opacity={0.08} />
      </mesh>
    </>
  )
}

// ─── ファイル1つ＝1ノード。浮遊しながら光る球 ───────────
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
            fontSize: '0.68rem',
            color: '#eae6d8',
            background: 'rgba(8, 12, 8, 0.88)',
            border: `1px solid ${color}`,
            borderRadius: 6,
            padding: '3px 9px',
            whiteSpace: 'nowrap',
            textShadow: `0 0 8px ${color}`,
            boxShadow: `0 0 12px ${color}33`,
            maxWidth: 180,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{fileName}</div>
          <div style={{ opacity: 0.75, fontSize: '0.6rem' }}>
            {words.slice(0, 3).join(' · ')}
          </div>
        </div>
      </Html>
    </group>
  )
}

// ─── コアからノードへの接続線。強度で太さ・脈動が変わる ──
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
    />
  )
}

// ─── ノード群を球面状に配置する ────────────────────────
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
      // フィボナッチ球面分布：ノードが増えるほど自然に球状に広がる
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

// ─── エクスポート：3D空間全体 ───────────────────────────
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
          'radial-gradient(ellipse at center, rgba(200,169,110,0.06) 0%, transparent 70%)',
      }}
    >
      <Canvas camera={{ position: [0, 0, 9], fov: 55 }} style={{ width: '100%', height: '100%' }}>
        <ambientLight intensity={0.35} />
        <pointLight position={[6, 6, 6]} intensity={1.4} color="#c8a96e" />
        <pointLight position={[-6, -4, -2]} intensity={0.8} color="#8fae7d" />
        <pointLight position={[0, 0, 3]} intensity={0.9} color="#ffffff" />
        <Stars radius={60} depth={30} count={2200} factor={3.2} fade speed={0.4} />
        <SynapseGraph nodes={nodes} onSelect={onSelect} />
        <OrbitControls
          enablePan={false}
          enableZoom
          rotateSpeed={0.55}
          zoomSpeed={0.5}
          minDistance={4}
          maxDistance={18}
          autoRotate
          autoRotateSpeed={0.35}
          target={[0, 0, 0]}
        />
      </Canvas>
    </div>
  )
}
