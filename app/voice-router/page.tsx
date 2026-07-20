"use client"

type SpeechRecognitionInstance = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

type SpeechRecognition = SpeechRecognitionInstance

const SpeechRecognition =
  typeof window !== "undefined"
    ? ((window as Window & {
        SpeechRecognition?: SpeechRecognitionConstructor
        webkitSpeechRecognition?: SpeechRecognitionConstructor
      }).SpeechRecognition ??
        (window as Window & {
          SpeechRecognition?: SpeechRecognitionConstructor
          webkitSpeechRecognition?: SpeechRecognitionConstructor
        }).webkitSpeechRecognition)
    : null
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import "./voice-router.css"

type VoiceSnapshot = {
  low: number
  mid: number
  high: number
  tension: number
}

type RouteScores = {
  Gemini: number
  Claude: number
  Perplexity: number
  GPT: number
  NotebookLM: number
  ARCHIVIST: number
}

type VoiceRoute = {
  ai: keyof RouteScores
  mode: string
  reason: string
  risk: "low" | "mid" | "high"
  confidence: number
  scores: RouteScores
  matched: string[]
}

type EvalState = "unset" | "good" | "bad"

type LogItem = {
  id: string
  role: "user" | "ai" | "system"
  text: string
  createdAt: string
  snap?: VoiceSnapshot
  route?: VoiceRoute
  eval?: EvalState
}

const SMOOTH = 0.8
const STORAGE_KEY = "voice-router-v3-log"

const PRESETS = [
  "このエラーを修正して。原因と直し方を短く出して",
  "この文章を整理して、見出しと箇条書きにして",
  "根拠付きで調べて。最新情報も確認して",
  "このアイデアを実装手順に分解して",
  "会議メモとして静かに記録して",
]



type SpeechRecognitionEventLike = Event & {
  resultIndex: number
  results: SpeechRecognitionResultList
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

function nowId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function createEmptySnap(): VoiceSnapshot {
  return { low: 0, mid: 0, high: 0, tension: 0 }
}

function clampScore(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)))
}

function pickTop(scores: RouteScores): keyof RouteScores {
  return (Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "NotebookLM") as keyof RouteScores
}

function useVoiceSensor() {
  const ref = useRef({ low: 0, mid: 0, high: 0 })
  const rafRef = useRef<number | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [liveSnap, setLiveSnap] = useState<VoiceSnapshot>(createEmptySnap)

  const snapshot = useCallback((): VoiceSnapshot => {
    const s = ref.current
    return {
      low: Number(s.low.toFixed(3)),
      mid: Number(s.mid.toFixed(3)),
      high: Number(s.high.toFixed(3)),
      tension: Math.min(100, Math.round(s.high * 140)),
    }
  }, [])

  const start = useCallback(async () => {
    if (ctxRef.current) return

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    streamRef.current = stream

    const ctx = new AudioContext()
    ctxRef.current = ctx

    const analyser = ctx.createAnalyser()
    analyser.fftSize = 1024

    const source = ctx.createMediaStreamSource(stream)
    source.connect(analyser)

    const bins = analyser.frequencyBinCount
    const data = new Uint8Array(bins)
    const lowEnd = Math.floor(bins * 0.1)
    const midEnd = Math.floor(bins * 0.4)
    const root = document.documentElement

    let tick = 0

    const loop = () => {
      analyser.getByteFrequencyData(data)

      let lowSum = 0
      let midSum = 0
      let highSum = 0

      for (let i = 0; i < bins; i++) {
        if (i < lowEnd) lowSum += data[i]
        else if (i < midEnd) midSum += data[i]
        else highSum += data[i]
      }

      const s = ref.current
      const nextLow = lowSum / lowEnd / 255
      const nextMid = midSum / (midEnd - lowEnd) / 255
      const nextHigh = highSum / (bins - midEnd) / 255

      s.low = s.low * SMOOTH + nextLow * (1 - SMOOTH)
      s.mid = s.mid * SMOOTH + nextMid * (1 - SMOOTH)
      s.high = s.high * SMOOTH + nextHigh * (1 - SMOOTH)

      root.style.setProperty("--voice-low", s.low.toFixed(3))
      root.style.setProperty("--voice-mid", s.mid.toFixed(3))
      root.style.setProperty("--voice-high", s.high.toFixed(3))

      tick += 1
      if (tick % 8 === 0) setLiveSnap(snapshot())

      rafRef.current = requestAnimationFrame(loop)
    }

    loop()
  }, [snapshot])

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null

    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null

    ctxRef.current?.close()
    ctxRef.current = null

    ref.current = { low: 0, mid: 0, high: 0 }
    setLiveSnap(createEmptySnap())

    const root = document.documentElement
    root.style.setProperty("--voice-low", "0")
    root.style.setProperty("--voice-mid", "0")
    root.style.setProperty("--voice-high", "0")
  }, [])

  useEffect(() => stop, [stop])

  return { start, stop, snapshot, liveSnap }
}

function routeForVoice(snap: VoiceSnapshot, text: string): VoiceRoute {
  const t = text.toLowerCase()
  const matched: string[] = []
  const scores: RouteScores = {
    Gemini: 18,
    Claude: 18,
    Perplexity: 18,
    GPT: 18,
    NotebookLM: 24,
    ARCHIVIST: 12,
  }

  const add = (ai: keyof RouteScores, score: number, label: string) => {
    scores[ai] = clampScore(scores[ai] + score)
    matched.push(`${label} → ${ai} +${score}`)
  }

  if (snap.tension >= 70) add("Gemini", 42, "高tension")
  if (snap.high >= 0.42) add("Gemini", 24, "高域強め")
  if (snap.mid >= 0.42) add("Claude", 28, "中域安定")
  if (snap.low >= 0.35 && snap.tension < 45) add("NotebookLM", 18, "低域中心")

  if (/整理|文章|要約|構成|設計|見出し|箇条書き/.test(t)) add("Claude", 42, "整理系キーワード")
  if (/検索|調べ|根拠|引用|最新|比較|ソース/.test(t)) add("Perplexity", 48, "調査系キーワード")
  if (/コード|実装|修正|エラー|tsx|css|api|バグ|デバッグ/.test(t)) add("GPT", 44, "実装系キーワード")
  if (/アイデア|発散|企画|案|ブレスト|大量/.test(t)) add("Gemini", 34, "発散系キーワード")
  if (/記録|メモ|保存|ログ|議事録|覚えて/.test(t)) add("NotebookLM", 40, "記録系キーワード")
  if (/渦巻き|渦|うずまき|昔の作品|あのhtml|あの作品|探して|回収|原典|呼び戻|world[\s-]?tree|ワールドツリー/i.test(t))
    add("ARCHIVIST", 60, "原典回収系キーワード")

  const ai = pickTop(scores)
  const ordered = Object.values(scores).sort((a, b) => b - a)
  const confidence = clampScore(ordered[0] - ordered[1] + 55)

  const config: Record<keyof RouteScores, Omit<VoiceRoute, "ai" | "confidence" | "scores" | "matched">> = {
    Gemini: {
      mode: "発散・高速生成",
      reason: "テンション、発散意図、または高域反応が強いため、速度優先の生成ルートへ回す",
      risk: "high",
    },
    Claude: {
      mode: "構造化・文章整理",
      reason: "整理、文章、設計、構成の意図が強いため、構造化ルートへ回す",
      risk: "mid",
    },
    Perplexity: {
      mode: "調査・根拠確認",
      reason: "検索、根拠、引用、最新確認の意図が強いため、調査ルートへ回す",
      risk: "low",
    },
    GPT: {
      mode: "実装・デバッグ",
      reason: "コード、実装、修正、エラー対応の意図が強いため、実装ルートへ回す",
      risk: "mid",
    },
    NotebookLM: {
      mode: "静音・記録",
      reason: "強い実行意図が薄い、または記録/保存の意図があるため、記録ルートへ回す",
      risk: "low",
    },
    ARCHIVIST: {
      mode: "原典回収・呼び戻し",
      reason: "渦巻き・昔の作品・探して・回収などの意図が強いため、原典回収ルートへ回す",
      risk: "low",
    },
  }

  return {
    ai,
    ...config[ai],
    confidence,
    scores,
    matched: matched.length ? matched : ["明確な一致なし → デフォルト記録ルート"],
  }
}

async function askAI(route: VoiceRoute, text: string, snap: VoiceSnapshot) {
  const res = await fetch("/api/llm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: route.ai,
      prompt: text,
      reason: route.reason,
      confidence: route.confidence,
      scores: route.scores,
      voice: snap,
    }),
  })

  if (!res.ok) throw new Error("API response was not ok")

  const data = await res.json()
  return data.reply ?? "応答は空でした。"
}

function downloadJson(log: LogItem[]) {
  const payload = {
    exportedAt: new Date().toISOString(),
    app: "voice-router-v3",
    logs: log,
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  })

  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `voice-router-log-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function downloadCsv(log: LogItem[]) {
  const rows = log
    .filter((item) => item.role === "user")
    .map((item) => ({
      id: item.id,
      createdAt: item.createdAt,
      text: item.text.replaceAll("\n", " "),
      route: item.route?.ai ?? "",
      mode: item.route?.mode ?? "",
      confidence: item.route?.confidence ?? "",
      eval: item.eval ?? "unset",
      tension: item.snap?.tension ?? "",
      low: item.snap?.low ?? "",
      mid: item.snap?.mid ?? "",
      high: item.snap?.high ?? "",
      reason: item.route?.reason ?? "",
    }))

  const header = Object.keys(rows[0] ?? {
    id: "",
    createdAt: "",
    text: "",
    route: "",
    mode: "",
    confidence: "",
    eval: "",
    tension: "",
    low: "",
    mid: "",
    high: "",
    reason: "",
  })

  const csv = [
    header.join(","),
    ...rows.map((row) =>
      header
        .map((key) => `"${String(row[key as keyof typeof row] ?? "").replaceAll('"', '""')}"`)
        .join(","),
    ),
  ].join("\n")

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `voice-router-log-${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function VoiceRouterPage() {
  const { start, stop, snapshot, liveSnap } = useVoiceSensor()
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState("")
  const [manualText, setManualText] = useState("")
  const [filter, setFilter] = useState("")
  const [log, setLog] = useState<LogItem[]>([])
  const [activeRoute, setActiveRoute] = useState<VoiceRoute | null>(null)
  const recRef = useRef<SpeechRecognition | null>(null)

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return

    try {
      const parsed = JSON.parse(raw) as LogItem[]
      if (Array.isArray(parsed)) setLog(parsed)
    } catch {}
  }, [])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(log))
  }, [log])

  const routedLogs = useMemo(() => log.filter((item) => item.role === "user"), [log])

  const filteredLog = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return log

    return log.filter((item) => {
      return (
        item.text.toLowerCase().includes(q) ||
        item.route?.ai.toLowerCase().includes(q) ||
        item.route?.mode.toLowerCase().includes(q) ||
        item.eval?.includes(q)
      )
    })
  }, [filter, log])

  const stats = useMemo(() => {
    const total = routedLogs.length
    const good = routedLogs.filter((item) => item.eval === "good").length
    const bad = routedLogs.filter((item) => item.eval === "bad").length
    const accuracy = good + bad > 0 ? Math.round((good / (good + bad)) * 100) : 0

    return {
      total,
      good,
      bad,
      accuracy,
      lastAi: routedLogs.at(-1)?.route?.ai ?? "--",
    }
  }, [routedLogs])

  const append = useCallback((item: Omit<LogItem, "id" | "createdAt">) => {
    setLog((items) => [
      ...items,
      {
        ...item,
        id: nowId(),
        createdAt: new Date().toISOString(),
      },
    ])
  }, [])

  const runRoute = useCallback(
    async (text: string, forcedSnap?: VoiceSnapshot) => {
      const clean = text.trim()
      if (!clean) return

      const snap = forcedSnap ?? snapshot()
      const route = routeForVoice(snap, clean)
      setActiveRoute(route)

      append({ role: "user", text: clean, snap, route, eval: "unset" })

      try {
        const reply = await askAI(route, clean, snap)
        append({ role: "ai", text: reply, route })
      } catch {
        append({
          role: "system",
          text: `API失敗。${route.ai} / ${route.mode} への振り分け記録だけ保存しました。`,
          route,
          snap,
        })
      }
    },
    [append, snapshot],
  )

  const begin = useCallback(async () => {
    const SpeechRecognitionApi =
      window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognitionApi) {
      alert("このブラウザは音声認識に未対応です。手入力モードで使えます。")
      await start()
      setListening(true)
      return
    }

    await start()

    const rec = new SpeechRecognitionApi()
    rec.lang = "ja-JP"
    rec.continuous = true
    rec.interimResults = true

    rec.onresult = (event: Event) => {
      const e = event as SpeechRecognitionEventLike
      let nextInterim = ""

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]
        const transcript = result[0]?.transcript ?? ""

        if (result.isFinal) runRoute(transcript)
        else nextInterim += transcript
      }

      setInterim(nextInterim)
    }

    rec.onend = () => {
      if (recRef.current) rec.start()
    }

    rec.start()
    recRef.current = rec
    setListening(true)
  }, [runRoute, start])

  const end = useCallback(() => {
    const rec = recRef.current
    recRef.current = null
    rec?.stop()

    window.speechSynthesis?.cancel()
    stop()

    setListening(false)
    setInterim("")
  }, [stop])

  const runManual = useCallback(
    (text = manualText) => {
      const snap = listening ? snapshot() : createEmptySnap()
      runRoute(text, snap)
      setManualText("")
    },
    [listening, manualText, runRoute, snapshot],
  )

  const setEval = useCallback((id: string, evalState: EvalState) => {
    setLog((items) =>
      items.map((item) => (item.id === id ? { ...item, eval: evalState } : item)),
    )
  }, [])

  const clearLog = useCallback(() => {
    setLog([])
    setActiveRoute(null)
    window.localStorage.removeItem(STORAGE_KEY)
  }, [])

  return (
    <main className="voice-router-page">
      <section className="voice-router-shell">
        <header className="voice-header">
          <p className="voice-kicker">VOICE ROUTER v3 / MOCK EVAL</p>
          <h1>声と意図でAIを振り分ける</h1>
          <p>
            外部AIには接続せず、ルーティング精度・判断理由・ログ評価だけを固めます。
          </p>
        </header>

        <div className="voice-grid">
          <section className="voice-panel primary">
            <div className="voice-orb-row">
              <div className="voice-core-orb" />
              <div className="voice-meta">
                <div>
                  tension <b>{liveSnap.tension}</b>
                </div>
                <div>low {liveSnap.low.toFixed(3)}</div>
                <div>mid {liveSnap.mid.toFixed(3)}</div>
                <div>high {liveSnap.high.toFixed(3)}</div>
                <div>
                  route{" "}
                  <span className="voice-route">
                    {activeRoute ? `${activeRoute.ai} / ${activeRoute.mode}` : "--"}
                  </span>
                </div>
                <div>
                  confidence{" "}
                  <b>{activeRoute ? `${activeRoute.confidence}%` : "--"}</b>
                </div>
                <div className="voice-controls">
                  {!listening ? (
                    <button type="button" onClick={begin}>
                      start voice route
                    </button>
                  ) : (
                    <button type="button" onClick={end}>
                      stop
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="voice-live">
              {interim || (listening ? "listening..." : "音声ルーティング待機中")}
            </div>
          </section>

          <section className="voice-panel">
            <h2>Manual test</h2>
            <textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="例: このエラーを修正して / この文章を整理して / 根拠付きで調べて"
            />
            <button type="button" onClick={() => runManual()}>
              run route
            </button>
            <div className="voice-presets">
              {PRESETS.map((preset) => (
                <button key={preset} type="button" onClick={() => runManual(preset)}>
                  {preset}
                </button>
              ))}
            </div>
          </section>

          <section className="voice-panel">
            <h2>Route reason</h2>
            <p className="voice-reason">
              {activeRoute?.reason ?? "まだルーティングされていません。"}
            </p>
            {activeRoute && (
              <>
                <div className="score-bars">
                  {Object.entries(activeRoute.scores).map(([name, score]) => (
                    <div key={name} className="score-row">
                      <span>{name}</span>
                      <div className="score-track">
                        <div style={{ width: `${score}%` }} />
                      </div>
                      <b>{score}</b>
                    </div>
                  ))}
                </div>
                <div className="matched-list">
                  {activeRoute.matched.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="voice-panel">
            <h2>Eval status</h2>
            <div className="voice-stats">
              <span>total {stats.total}</span>
              <span>good {stats.good}</span>
              <span>bad {stats.bad}</span>
              <span>accuracy {stats.accuracy}%</span>
              <span>last {stats.lastAi}</span>
            </div>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="ログ検索: gpt / claude / bad / エラー"
              className="voice-filter"
            />
            <div className="voice-export">
              <button type="button" onClick={() => downloadJson(log)}>
                json
              </button>
              <button type="button" onClick={() => downloadCsv(log)}>
                csv
              </button>
              <button type="button" onClick={clearLog}>
                clear
              </button>
            </div>
          </section>
        </div>

        <section className="voice-log-wrap">
          <h2>Routing log</h2>
          <div className="voice-log">
            {filteredLog.length === 0 ? (
              <div className="voice-empty">まだログはありません。</div>
            ) : (
              filteredLog.map((item) => (
                <div
                  key={item.id}
                  className={`voice-msg ${item.role === "user" ? "user" : item.role === "ai" ? "ai" : "system"}`}
                >
                  <div className="voice-tag">
                    {item.role}
                    {item.route ? ` / ${item.route.ai} / ${item.route.mode}` : ""}
                    {item.route ? ` / confidence ${item.route.confidence}%` : ""}
                  </div>
                  <div>{item.text}</div>
                  {item.snap && (
                    <div className="voice-snap">
                      tension:{item.snap.tension} low:{item.snap.low} mid:{item.snap.mid} high:{item.snap.high}
                    </div>
                  )}
                  {item.role === "user" && (
                    <div className="eval-buttons">
                      <button type="button" onClick={() => setEval(item.id, "good")}>
                        good
                      </button>
                      <button type="button" onClick={() => setEval(item.id, "bad")}>
                        bad
                      </button>
                      <button type="button" onClick={() => setEval(item.id, "unset")}>
                        unset
                      </button>
                      <span>eval: {item.eval ?? "unset"}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </section>
    </main>
  )
}
