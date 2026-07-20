'use client'

import { useState, useCallback, useEffect, useMemo, useRef, KeyboardEvent } from 'react'
import type { CSSProperties } from 'react'
import dynamic from 'next/dynamic'
import './world-tree.css'

const SynapseSphere = dynamic(() => import('./SynapseSphere'), { ssr: false })

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

// ── 型定義 ──────────────────────────────────────────
interface TreeNode {
  name: string
  series: string
  status: string
  nextAction: string
}

interface LogEntry {
  time: string
  query: string
  hits: string[]
  count: number
}

// ─── SYNAPSE VIEW: 型定義 ──────────────────────────
interface SynapseNode {
  id: string
  fileName: string
  words: string[]
  x: number
  y: number
  vx: number
  vy: number
  depth: number
  strength: number
  color: string
}

interface SynapseLink {
  a: string
  b: string
  weight: number
}

// ─── SYNAPSE VIEW: 背景の浮遊パーティクル（固定シード、奥行きの空気感）───
const BG_PARTICLES = Array.from({ length: 26 }, (_, i) => {
  const seed = i * 37.1
  return {
    cx: (seed * 13) % 100,
    cy: (seed * 7) % 100,
    r: 0.25 + ((seed * 3) % 10) / 20,
    baseOpacity: 0.08 + ((seed * 5) % 10) / 40,
    dur: 4 + ((seed * 11) % 10),
    drift: 3 + ((seed * 17) % 10),
  }
})

// ─── SYNAPSE VIEW: 単語抽出（簡易版・形態素解析なし）───
const STOP_TOKENS = new Set([
  'これ', 'それ', 'あれ', 'この', 'その', 'あの', 'ここ', 'そこ',
  'です', 'ます', 'した', 'して', 'ある', 'いる', 'なる', 'こと',
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'have',
])

function extractWords(text: string): string[] {
  // カタカナ連続・漢字連続・英単語(3文字以上)・数字付き識別子を候補として抜く
  const matches = text.match(
    /[ァ-ヶー]{2,}|[一-龠]{2,}|[a-zA-Z][a-zA-Z0-9_-]{2,}/g,
  )
  if (!matches) return []

  const freq = new Map<string, number>()
  for (const m of matches) {
    const w = m.trim()
    if (w.length < 2) continue
    if (STOP_TOKENS.has(w.toLowerCase())) continue
    freq.set(w, (freq.get(w) ?? 0) + 1)
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w)
}

// ─── SYNAPSE VIEW: ノードの色（系統ワードで決定） ──────
const COLOR_RULES: [RegExp, string][] = [
  [/渦|ワームホール|wormhole|torus|swirl/i, '#c8a96e'],
  [/gate|ゲート|voyage|旅/i, '#8fae7d'],
  [/voice|声|ui|archivist/i, '#7d9dae'],
  [/mdac|絵本|enka/i, '#ae7d9d'],
]

function colorForWords(words: string[]): string {
  const joined = words.join(' ')
  for (const [re, color] of COLOR_RULES) {
    if (re.test(joined)) return color
  }
  return '#9a9a86'
}

// ─── SYNAPSE VIEW: ノード間の共通単語からリンクを計算 ───
function computeLinks(nodes: SynapseNode[]): SynapseLink[] {
  const links: SynapseLink[] = []
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const shared = nodes[i].words.filter((w) => nodes[j].words.includes(w))
      if (shared.length > 0) {
        links.push({ a: nodes[i].id, b: nodes[j].id, weight: shared.length })
      }
    }
  }
  return links
}


// ── 固定ノード ────────────────────────────────────────
const NODES: TreeNode[] = [
  {
    name: 'Wormhole Archive / Web',
    series: 'VOYAGE / WORMHOLE',
    status: '初期展示を構築中',
    nextAction: '3作品選定とiframe隔離',
  },
  {
    name: 'World Tree / Root',
    series: 'CORE',
    status: '司令ハブ構築中',
    nextAction: '各系統の呼び戻し検索を育てる',
  },
  {
    name: 'Mobile Wormhole',
    series: 'VOYAGE / WORMHOLE',
    status: '保留',
    nextAction: 'Web版完成後に独立設計',
  },
  {
    name: 'VOYAGE',
    series: 'VOYAGE',
    status: '複数制作が進行中',
    nextAction: 'Wormhole展示を安定化',
  },
  {
    name: 'ENKA',
    series: 'ENKA',
    status: '構想・実験段階',
    nextAction: 'Wormhole側の完了後に再開',
  },
  {
    name: 'AI UI',
    series: 'AI UI',
    status: 'Voice Routerなどを試作済み',
    nextAction: 'World Treeとの接続を検討',
  },
  {
    name: 'CryptoGate',
    series: 'CryptoGate',
    status: '実験済み・保留',
    nextAction: 'Gate演出への応用を検討',
  },
  {
    name: 'UI Experiments',
    series: 'UI実験群',
    status: '試作が散在',
    nextAction: '再利用できる部品を選ぶ',
  },
]

// ── 検索ヘルパー ──────────────────────────────────────
function normalize(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase()
}

// 別名辞書：トークンがヒットしたら正式名（系統名）も検索語に加える
const ALIAS_MAP: Record<string, string[]> = {
  'Wormhole': ['渦', 'ワームホール', 'wormhole'],
  'Wormhole Archive': ['3d', '展示', 'アーカイブ'],
  'CryptoGate': ['gate', 'ゲート'],
  'AI UI': ['声', 'voice'],
  'UI Experiments': ['ui', 'インターフェース'],
  'VOYAGE': ['旅', 'voyage'],
}

// ストップワード：検索語として使わない助詞・汎用語
const STOP_WORDS = new Set([
  'の', 'は', 'を', 'に', 'で', 'と', 'や', 'が', 'も',
  'へ', 'から', 'より', 'あの', 'この', 'その', '作品',
  '設計', '展示',
])

// 入力文を読点・句読点・空白・スラッシュ・ハイフン・主要な助詞で分割してトークン化
function tokenize(input: string): string[] {
  return input
    .split(/[\s、。・\/\-]+|の|は|を|に|で|と|や|が|も|へ/g)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !STOP_WORDS.has(t))
}

// トークンが別名辞書にヒットしたら、正式名＋その別名群を検索語に加える
function expandWithAliases(tokens: string[]): string[] {
  const expanded = new Set(tokens.map((t) => normalize(t)))
  for (const token of tokens) {
    const nt = normalize(token)
    for (const [canonical, aliases] of Object.entries(ALIAS_MAP)) {
      const normalizedAliases = aliases.map((a) => normalize(a))
      if (normalizedAliases.includes(nt) || normalize(canonical) === nt) {
        expanded.add(normalize(canonical))
        normalizedAliases.forEach((a) => expanded.add(a))
      }
    }
  }
  return Array.from(expanded)
}

function findMatchReasonTokens(
  node: TreeNode,
  tokens: string[],
): { reason: string; matchedTokens: string[] } {
  const fields: [string, string][] = [
    ['名前', node.name],
    ['系統', node.series],
    ['状態', node.status],
    ['次の一手', node.nextAction],
  ]

  const hitParts: string[] = []
  const matchedTokens = new Set<string>()

  for (const [label, value] of fields) {
    const normalizedValue = normalize(value)
    const tokenHits = tokens.filter((t) => normalizedValue.includes(t))
    if (tokenHits.length > 0) {
      hitParts.push(label)
      tokenHits.forEach((t) => matchedTokens.add(t))
    }
  }

  const reason =
    hitParts.length > 0 ? hitParts.join('・') + ' に一致' : '関連ワードに一致'

  return { reason, matchedTokens: Array.from(matchedTokens) }
}

function searchNodes(query: string): { node: TreeNode; reason: string }[] {
  if (!query.trim()) return []

  const rawTokens = tokenize(query)
  if (rawTokens.length === 0) return []

  const tokens = expandWithAliases(rawTokens)

  return NODES.filter((n) =>
    tokens.some((t) =>
      [n.name, n.series, n.status, n.nextAction].some((v) => normalize(v).includes(t)),
    ),
  ).map((node) => {
    const { reason } = findMatchReasonTokens(node, tokens)
    return { node, reason }
  })
}

// ── 時刻フォーマット ──────────────────────────────────
function formatTime(d: Date): string {
  return d.toTimeString().slice(0, 8)
}

// ── コンポーネント ────────────────────────────────────
// ─── SYNAPSE VIEW: コンポーネント ─────────────────────
function SynapseView() {
  const [nodes, setNodes] = useState<SynapseNode[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [focusWord, setFocusWord] = useState('')
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d')
  const animRef = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const links = useMemo(() => computeLinks(nodes), [nodes])

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) =>
      /\.(md|txt|log|json)$/i.test(f.name),
    )
    if (list.length === 0) return

    const newNodes: SynapseNode[] = []
    for (const file of list) {
      const text = await file.text()
      const words = extractWords(text)
      newNodes.push({
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        fileName: file.name,
        words,
        x: 50 + Math.random() * 40 - 20,
        y: 50 + Math.random() * 40 - 20,
        vx: (Math.random() - 0.5) * 0.06,
        vy: (Math.random() - 0.5) * 0.06,
        depth: 0.3 + Math.random() * 0.7,
        strength: 0.5,
        color: colorForWords(words),
      })
    }
    setNodes((prev) => [...prev, ...newNodes])
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragOver(false)
      if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files)
    },
    [addFiles],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) addFiles(e.target.files)
      e.target.value = ''
    },
    [addFiles],
  )

  // 浮遊アニメーション：位置を更新し続ける
  useEffect(() => {
    const tick = () => {
      setNodes((prev) =>
        prev.map((n) => {
          let nx = n.x + n.vx
          let ny = n.y + n.vy
          let nvx = n.vx
          let nvy = n.vy
          if (nx < 8 || nx > 92) nvx = -nvx
          if (ny < 10 || ny > 90) nvy = -nvy
          nx = Math.max(8, Math.min(92, nx))
          ny = Math.max(10, Math.min(90, ny))
          return { ...n, x: nx, y: ny, vx: nvx, vy: nvy }
        }),
      )
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [])

  // フォーカス単語との一致でstrengthを更新（声・テキスト入力で反応させる）
  const focusOn = useCallback((word: string) => {
    const w = word.trim()
    setFocusWord(w)
    if (!w) return
    const q = w.toLowerCase()
    setNodes((prev) =>
      prev.map((n) => {
        const hit = n.words.some((word2) => word2.toLowerCase().includes(q))
        const next = hit
          ? Math.min(1, n.strength + 0.3)
          : Math.max(0.15, n.strength - 0.1)
        return { ...n, strength: next }
      }),
    )
  }, [])

  const clearAll = useCallback(() => {
    setNodes([])
    setFocusWord('')
  }, [])

  return (
    <section className="wt-synapse">
      <div className="wt-synapse-header">
        <p className="wt-section-label">SYNAPSE VIEW — 思考ノード空間</p>
        <div className="wt-synapse-viewtoggle">
          <button
            className={cn('wt-btn wt-btn-sm', viewMode === '2d' && 'is-active')}
            onClick={() => setViewMode('2d')}
          >
            平面
          </button>
          <button
            className={cn('wt-btn wt-btn-sm', viewMode === '3d' && 'is-active')}
            onClick={() => setViewMode('3d')}
            disabled={nodes.length === 0}
          >
            立体
          </button>
        </div>
      </div>

      <div
        className={cn('wt-synapse-drop', isDragOver && 'is-over')}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <p>md / txt / log / json をここにドラッグ&ドロップ</p>
        <label className="wt-btn wt-btn-sm wt-synapse-filelabel">
          またはファイルを選ぶ
          <input
            type="file"
            multiple
            accept=".md,.txt,.log,.json"
            onChange={handleFileInput}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      <div className="wt-synapse-controls">
        <input
          className="wt-input"
          placeholder="単語で指す（例：wormhole / 声 / gate）"
          value={focusWord}
          onChange={(e) => setFocusWord(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') focusOn(focusWord)
          }}
        />
        <button className="wt-btn wt-btn-sm" onClick={() => focusOn(focusWord)}>
          指す
        </button>
        <button
          className="wt-btn wt-btn-sm wt-btn-danger"
          onClick={clearAll}
          disabled={nodes.length === 0}
        >
          全消去
        </button>
      </div>

      {viewMode === '3d' && nodes.length > 0 ? (
        <SynapseSphere
          nodes={nodes.map((n) => ({
            id: n.id,
            fileName: n.fileName,
            words: n.words,
            color: n.color,
            strength: n.strength,
          }))}
          onSelect={(id) => {
            const n = nodes.find((x) => x.id === id)
            if (n) focusOn(n.words[0] ?? n.fileName)
          }}
        />
      ) : (
      <div className="wt-synapse-space" ref={containerRef}>
        {/* 背景の浮遊パーティクル：常時表示、奥行きの空気感を出す */}
        <svg className="wt-synapse-bg-particles" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {BG_PARTICLES.map((p, i) => (
            <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill="#c8a96e" opacity={p.baseOpacity}>
              <animate
                attributeName="opacity"
                values={`${p.baseOpacity * 0.2};${p.baseOpacity};${p.baseOpacity * 0.2}`}
                dur={`${p.dur}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="cy"
                values={`${p.cy};${p.cy - p.drift};${p.cy}`}
                dur={`${p.dur * 1.4}s`}
                repeatCount="indefinite"
              />
            </circle>
          ))}
        </svg>

        {nodes.length === 0 ? (
          <p className="wt-synapse-empty">
            まだノードがない。ファイルを入れると、単語が浮かび上がる。
          </p>
        ) : (
          <>
            <svg className="wt-synapse-links" viewBox="0 0 100 100" preserveAspectRatio="none">
              {links.map((link, i) => {
                const a = nodes.find((n) => n.id === link.a)
                const b = nodes.find((n) => n.id === link.b)
                if (!a || !b) return null
                const opacity = Math.min(0.85, 0.15 + link.weight * 0.18)
                const width = Math.min(1.2, 0.15 + link.weight * 0.18)
                const pulseDur = Math.max(1.6, 3.2 - link.weight * 0.4)
                return (
                  <g key={i}>
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="#c8a96e"
                      strokeOpacity={opacity}
                      strokeWidth={width}
                    />
                    {/* 線の上を流れるエネルギー粒子 */}
                    <circle r={0.55} fill="#e8d3a0">
                      <animateMotion
                        dur={`${pulseDur}s`}
                        repeatCount="indefinite"
                        path={`M${a.x},${a.y} L${b.x},${b.y}`}
                      />
                      <animate
                        attributeName="opacity"
                        values="0;0.9;0"
                        dur={`${pulseDur}s`}
                        repeatCount="indefinite"
                      />
                    </circle>
                  </g>
                )
              })}
            </svg>

            {nodes
              .slice()
              .sort((x, y) => x.depth - y.depth)
              .map((n) => (
                <div
                  key={n.id}
                  className="wt-synapse-node"
                  style={
                    {
                      left: `${n.x}%`,
                      top: `${n.y}%`,
                      '--node-color': n.color,
                      '--node-strength': n.strength,
                      zIndex: Math.round(n.depth * 100),
                      filter: `blur(${(1 - n.depth) * 1.4}px)`,
                      transform: `translate(-50%, -50%) scale(${(0.55 + n.depth * 0.55) * (0.75 + n.strength * 0.5)})`,
                      opacity: (0.35 + n.strength * 0.65) * (0.5 + n.depth * 0.5),
                    } as CSSProperties
                  }
                  title={n.fileName}
                >
                  <span className="wt-synapse-node-ring" />
                  <span className="wt-synapse-node-label">{n.fileName}</span>
                  <div className="wt-synapse-node-words">
                    {n.words.slice(0, 4).map((w, wi) => (
                      <span key={wi}>{w}</span>
                    ))}
                  </div>
                </div>
              ))}
          </>
        )}
      </div>
      )}
    </section>
  )
}


export default function WorldTreePage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ node: TreeNode; reason: string }[] | null>(null)
  const [log, setLog] = useState<LogEntry[]>([])

  const runSearch = useCallback(() => {
    const q = query.trim()
    if (!q) return
    const found = searchNodes(q)
    setResults(found)
    const entry: LogEntry = {
      time: formatTime(new Date()),
      query: q,
      hits: found.map((r) => r.node.name),
      count: found.length,
    }
    setLog((prev) => [entry, ...prev])
  }, [query])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') runSearch()
  }

  const exportJSON = () => {
    if (log.length === 0) return
    const blob = new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `world-tree-recall-log-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportCSV = () => {
    if (log.length === 0) return
    const header = '時刻,入力文,ヒットノード,件数'
    const rows = log.map((e) =>
      [
        e.time,
        `"${e.query.replace(/"/g, '""')}"`,
        `"${e.hits.join(' | ').replace(/"/g, '""')}"`,
        e.count,
      ].join(',')
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `world-tree-recall-log-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const clearLog = () => {
    setLog([])
    setResults(null)
  }

  const CORE_NODES_DISPLAY = [
    { name: 'Wormhole Archive / Web', badge: 'NOW', badgeClass: 'wt-badge-now', series: 'VOYAGE / WORMHOLE' },
    { name: 'World Tree / Root', badge: 'NEXT', badgeClass: 'wt-badge-next', series: 'CORE' },
    { name: 'Mobile Wormhole', badge: 'PARKED', badgeClass: 'wt-badge-parked', series: 'VOYAGE / WORMHOLE' },
  ]

  return (
    <div className="wt-root">
      {/* ── ヘッダー ── */}
      <header className="wt-header">
        <p className="wt-header-title">WORLD TREE</p>
        <h1 className="wt-header-name">COMMAND HUB</h1>
      </header>

      <main className="wt-main">
        {/* ── 今日の司令情報 ── */}
        <section className="wt-section">
          <p className="wt-section-label">STATUS</p>
          <div className="wt-hub-grid">
            <div className="wt-hub-cell">
              <p className="wt-hub-cell-label">今日の主戦場</p>
              <p className="wt-hub-cell-value">
                <strong>Wormhole Archive</strong> — Web版
              </p>
            </div>
            <div className="wt-hub-cell">
              <p className="wt-hub-cell-label">次の一手</p>
              <p className="wt-hub-cell-value">
                0–100 Gate → 3作品だけ稼働する展示グリッド
              </p>
            </div>
          </div>
          <p className="wt-section-label" style={{ marginTop: '1rem' }}>原則</p>
          <ul className="wt-principles">
            <li>既存HTMLは壊さない。iframeで隔離。</li>
            <li>全作品の常時再生はしない。GPU枠は最大3作品。</li>
          </ul>
        </section>

        {/* ── NOW / CURRENT TARGET ── */}
        <section className="wt-section">
          <p className="wt-section-label">01 / NOW — 今日やること</p>
          <ul className="wt-list">
            <li>Wormhole Archive / Web版の最初の画面構成を決める</li>
            <li>0–100 Gateの役割を「入場演出＋選抜起動」に固定する</li>
            <li>最初に展示する3作品を選ぶ</li>
            <li>manifest.jsonの最小項目を決める</li>
          </ul>
        </section>

        <section className="wt-section">
          <p className="wt-section-label">02 / CURRENT TARGET</p>
          <ul className="wt-list">
            <li>GATE v0 / World Tree / Wormhole Archive</li>
            <li>目的：動くHTML作品を「生きたまま」展示する</li>
            <li>対象：Web版のみ。スマホ版は別作品として後で設計する</li>
            <li>成功条件：一覧で3作品が動き、Enterで原寸へ入れる</li>
          </ul>
        </section>

        {/* ── NON-NEGOTIABLES / NEXT 3 ACTIONS ── */}
        <div className="wt-two-col">
          <section className="wt-section">
            <p className="wt-section-label">03 / NON-NEGOTIABLES</p>
            <ul className="wt-list">
              <li>既存HTMLを直接改造しない</li>
              <li>iframeで作品を隔離する</li>
              <li>画面外の作品は起動しない</li>
              <li>同時フル稼働は最大3作品</li>
              <li>詳細表示中はカタログ側の稼働枠を渡す</li>
              <li>作品は「ファイル」ではなく「系統＋変異」として残す</li>
            </ul>
          </section>

          <section className="wt-section">
            <p className="wt-section-label">04 / NEXT 3 ACTIONS</p>
            <ul className="wt-list">
              {['最初の展示作品を3つ決める', '各作品にtitle / series / parent / mutation / tech / motionを付ける', 'Web版のワイヤーを作る'].map(
                (item, i) => (
                  <li key={i} className="wt-list-numbered">
                    <span className="wt-list-num">{i + 1}.</span>
                    <span>{item}</span>
                  </li>
                )
              )}
            </ul>
          </section>
        </div>

        {/* ── PARKING LOT ── */}
        <section className="wt-section">
          <p className="wt-section-label">05 / PARKING LOT</p>
          <ul className="wt-principles">
            <li>Mobile WormholeはWeb版完成後に別作品として設計</li>
            <li>?thumbnail=1 による軽量モードは第2段階</li>
            <li>全作品をmanifest化するのは初回展示が成立してから</li>
          </ul>
        </section>

        {/* ── CORE NODES ── */}
        <section>
          <p className="wt-section-label" style={{ marginBottom: '0.8rem' }}>06 / CORE NODES — 表示は3件</p>
          <div className="wt-nodes">
            {CORE_NODES_DISPLAY.map((n) => (
              <div key={n.name} className="wt-node">
                <div>
                  <p className="wt-node-name">{n.name}</p>
                  <p className="wt-node-series">{n.series}</p>
                </div>
                <span className={`wt-node-badge ${n.badgeClass}`}>{n.badge}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── RECALL CONSOLE ── */}
        <section className="wt-recall">
          <p className="wt-section-label">RECALL CONSOLE</p>
          <h2 className="wt-section-heading">呼び戻す</h2>
          <div className="wt-recall-row">
            <input
              type="text"
              className="wt-recall-input"
              placeholder="例：あの渦の作品、3Dの展示、CryptoGateの設計"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label="呼び戻し検索"
            />
            <button
              className="wt-btn"
              onClick={runSearch}
              aria-label="呼び戻す"
            >
              呼び戻す
            </button>
          </div>

          {results !== null && (
            <div className="wt-results" aria-live="polite">
              {results.length === 0 ? (
                <p className="wt-no-result">
                  まだ枝がない。新しい枝として記録候補。
                </p>
              ) : (
                results.map((r) => (
                  <div key={r.node.name} className="wt-result-card">
                    <p className="wt-result-name">{r.node.name}</p>
                    <div className="wt-result-grid">
                      <div className="wt-result-field">
                        <span className="wt-result-field-label">系統</span>
                        <span className="wt-result-field-value">{r.node.series}</span>
                      </div>
                      <div className="wt-result-field">
                        <span className="wt-result-field-label">現在の状態</span>
                        <span className="wt-result-field-value">{r.node.status}</span>
                      </div>
                      <div className="wt-result-field" style={{ gridColumn: '1 / -1' }}>
                        <span className="wt-result-field-label">次の一手</span>
                        <span className="wt-result-field-value">{r.node.nextAction}</span>
                      </div>
                    </div>
                    <p className="wt-result-reason">
                      一致理由：<span>{r.reason}</span>
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </section>

        {/* ── RECALL LOG ── */}
        <section className="wt-log">
          <p className="wt-section-label">RECALL LOG</p>
          <div className="wt-log-actions">
            <button
              className="wt-btn wt-btn-sm"
              onClick={exportJSON}
              disabled={log.length === 0}
              aria-label="JSON書き出し"
            >
              JSON書き出し
            </button>
            <button
              className="wt-btn wt-btn-sm"
              onClick={exportCSV}
              disabled={log.length === 0}
              aria-label="CSV書き出し"
            >
              CSV書き出し
            </button>
            <button
              className="wt-btn wt-btn-sm wt-btn-danger"
              onClick={clearLog}
              disabled={log.length === 0}
              aria-label="このセッションを消去"
            >
              このセッションを消去
            </button>
          </div>

          {log.length === 0 ? (
            <p className="wt-log-empty">— ログなし —</p>
          ) : (
            <div className="wt-log-list" aria-label="検索ログ">
              {log.map((entry, i) => (
                <div key={i} className="wt-log-row">
                  <span className="wt-log-time">{entry.time}</span>
                  <span className="wt-log-query">{entry.query}</span>
                  <span className="wt-log-count">{entry.count}件</span>
                  {entry.hits.length > 0 && (
                    <span className="wt-log-hits">
                      {entry.hits.join(' / ')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <SynapseView />
      </main>
    </div>
  )
}
