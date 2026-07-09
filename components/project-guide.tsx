import { Boxes, Coins, Route, Compass } from "lucide-react"
import { projectGuide, type GuideCard } from "@/lib/perplexity-data"

const iconMap: Record<GuideCard["icon"], typeof Boxes> = {
  parts: Boxes,
  cost: Coins,
  flow: Route,
}

export function ProjectGuide() {
  return (
    <section aria-labelledby="guide-title">
      <div className="mb-6 flex flex-col gap-2">
        <div className="flex items-baseline gap-3">
          <h2
            id="guide-title"
            className="font-heading text-2xl font-bold tracking-tight text-foreground"
          >
            このアプリの中身
          </h2>
          <span className="font-mono text-sm text-gold/70">
            {String(projectGuide.length).padStart(2, "0")}
          </span>
        </div>
        <p className="flex max-w-2xl items-center gap-2 text-pretty text-sm leading-relaxed text-muted-foreground">
          <Compass className="size-4 shrink-0 text-gold/80" aria-hidden="true" />
          <span>
            <span className="text-gold/90">自己ガイド</span>
            ：この仕組み・お金・使い方を、自分のためにひと目で。
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {projectGuide.map((card) => {
          const Icon = iconMap[card.icon]
          return (
            <article
              key={card.title}
              className="glass glow-hover group relative flex flex-col rounded-2xl p-6"
            >
              <header className="mb-4 flex items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[rgba(201,168,76,0.3)] bg-[rgba(201,168,76,0.08)]">
                  <Icon className="size-5 text-gold" aria-hidden="true" />
                </span>
                <span className="rounded-full border border-[rgba(201,168,76,0.35)] bg-[rgba(201,168,76,0.08)] px-2.5 py-0.5 text-xs font-semibold tracking-wide text-gold">
                  {card.iconLabel}
                </span>
              </header>

              <h3 className="font-heading text-pretty text-lg font-bold leading-snug text-foreground transition-colors group-hover:text-gold">
                {card.title}
              </h3>

              <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
                {card.lead}
              </p>

              <div className="my-4 h-px w-full gold-hairline opacity-60" />

              <ul className="flex flex-col gap-3">
                {card.items.map((it) => (
                  <li key={it.label} className="flex flex-col gap-1">
                    <span className="text-xs font-semibold tracking-wide text-gold/85">
                      {it.label}
                    </span>
                    <span className="text-pretty text-[14px] leading-relaxed text-foreground/90">
                      {it.text}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-5 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <Compass
                  className="mt-0.5 size-4 shrink-0 text-gold/70"
                  aria-hidden="true"
                />
                <div>
                  <span className="text-[11px] font-semibold tracking-wide text-muted-foreground">
                    道しるべ
                  </span>
                  <p className="text-pretty text-[13px] leading-relaxed text-muted-foreground">
                    {card.note}
                  </p>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
