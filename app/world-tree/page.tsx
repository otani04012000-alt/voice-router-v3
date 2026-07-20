'use client'

import { useState, useCallback, KeyboardEvent } from 'react'
import './world-tree.css'

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

function findMatchReason(node: TreeNode, query: string): string {
  const q = normalize(query)
  const fields: [string, string][] = [
    ['名前', node.name],
    ['系統', node.series],
    ['状態', node.status],
    ['次の一手', node.nextAction],
  ]
  const matched = fields
    .filter(([, v]) => normalize(v).includes(q))
    .map(([k]) => k)
  return matched.length > 0 ? matched.join('・') + ' に一致' : '関連ワードに一致'
}

function searchNodes(query: string): { node: TreeNode; reason: string }[] {
  if (!query.trim()) return []
  const q = normalize(query)
  return NODES.filter((n) =>
    [n.name, n.series, n.status, n.nextAction].some((v) => normalize(v).includes(q))
  ).map((node) => ({ node, reason: findMatchReason(node, query) }))
}

// ── 時刻フォーマット ──────────────────────────────────
function formatTime(d: Date): string {
  return d.toTimeString().slice(0, 8)
}

// ── コンポーネント ────────────────────────────────────
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
      </main>
    </div>
  )
}
