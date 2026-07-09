"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { models, features, logs } from "@/lib/perplexity-data"
import { QuickRules } from "@/components/quick-rules"
import { InfoCard } from "@/components/info-card"
import { ProjectGuide } from "@/components/project-guide"

export default function Page() {
  const [query, setQuery] = useState("")

  const q = query.trim().toLowerCase()

  const match = (text: string) => text.toLowerCase().includes(q)

  const filteredModels = useMemo(
    () =>
      !q
        ? models
        : models.filter(
            (m) =>
              match(m.name) ||
              match(m.use) ||
              match(m.demerit) ||
              (m.tag ? match(m.tag) : false),
          ),
    [q],
  )

  const filteredFeatures = useMemo(
    () =>
      !q
        ? features
        : features.filter(
            (f) => match(f.name) || match(f.use) || match(f.demerit),
          ),
    [q],
  )

  const filteredLogs = useMemo(
    () =>
      !q
        ? logs
        : logs.filter(
            (l) =>
              match(l.name) ||
              match(l.use) ||
              match(l.demerit) ||
              (l.point ? match(l.point) : false),
          ),
    [q],
  )

  const total =
    filteredModels.length + filteredFeatures.length + filteredLogs.length

  return (
    <main className="ambient-bg min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <header className="mb-16 flex flex-col items-center text-center">
          <p className="mb-3 text-xs font-medium tracking-[0.35em] text-gold uppercase">
            Perplexity
          </p>
          <h1 className="font-heading text-balance text-4xl font-black tracking-tight text-foreground sm:text-6xl">
            モデル・機能 使い分けガイド
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground">
            どれを選べばいいか一目で分かる早見表。用途を主役に、注意点は静かに。
          </p>
        </header>

        <div className="mb-20">
          <QuickRules />
        </div>

        <div className="mb-14 flex flex-col items-center">
          <div className="mb-10 h-px w-full max-w-xs gold-hairline" />
          <div className="sticky top-4 z-10 w-full max-w-xl">
            <label htmlFor="filter" className="sr-only">
              モデル・機能を検索
            </label>
            <div className="glass relative rounded-2xl">
              <Search
                className="pointer-events-none absolute left-5 top-1/2 size-5 -translate-y-1/2 text-gold/70"
                aria-hidden="true"
              />
              <input
                id="filter"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="名前・用途・注意点で絞り込み（例: 文章、コード、調査）"
                className="w-full rounded-2xl bg-transparent py-4 pl-14 pr-5 text-foreground outline-none placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-[rgba(201,168,76,0.35)]"
              />
            </div>
          </div>
        </div>

        <div className="space-y-16">
          {total === 0 ? (
            <p className="glass rounded-2xl py-16 text-center text-muted-foreground">
              「{query}」に一致する項目は見つかりませんでした。
            </p>
          ) : (
            <>
              {filteredModels.length > 0 && (
                <Section
                  title="モデル"
                  count={filteredModels.length}
                  id="models"
                >
                  {filteredModels.map((m) => (
                    <InfoCard key={m.name} item={m} variant="model" />
                  ))}
                </Section>
              )}

              {filteredFeatures.length > 0 && (
                <Section
                  title="機能"
                  count={filteredFeatures.length}
                  id="features"
                >
                  {filteredFeatures.map((f) => (
                    <InfoCard key={f.name} item={f} variant="feature" />
                  ))}
                </Section>
              )}
            </>
          )}

          <div className="h-px w-full max-w-xs gold-hairline mx-auto" />

          <ProjectGuide />

          {filteredLogs.length > 0 && (
            <Section
              title="実証ログ"
              subtitle="俺がアプリになる構想 — 自分専用の制作ハブを組み立てる検証記録。"
              count={filteredLogs.length}
              id="logs"
            >
              {filteredLogs.map((l) => (
                <InfoCard key={l.name} item={l} variant="log" />
              ))}
            </Section>
          )}
        </div>

        <footer className="mt-24 flex flex-col items-center gap-4 text-center">
          <div className="h-px w-full max-w-xs gold-hairline" />
          <p className="text-xs tracking-wide text-muted-foreground">
            用途を主役に、注意点は控えめに。迷ったら「迷ったらコレ」へ。
          </p>
        </footer>
      </div>
    </main>
  )
}

function Section({
  title,
  subtitle,
  count,
  id,
  children,
}: {
  title: string
  subtitle?: string
  count: number
  id: string
  children: React.ReactNode
}) {
  return (
    <section aria-labelledby={`${id}-title`}>
      <div className="mb-6 flex flex-col gap-2">
        <div className="flex items-baseline gap-3">
          <h2
            id={`${id}-title`}
            className="font-heading text-2xl font-bold tracking-tight text-foreground"
          >
            {title}
          </h2>
          <span className="font-mono text-sm text-gold/70">
            {String(count).padStart(2, "0")}
          </span>
        </div>
        {subtitle && (
          <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </section>
  )
}
