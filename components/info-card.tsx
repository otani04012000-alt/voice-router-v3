import { Info, Lightbulb } from "lucide-react"
import type { Item } from "@/lib/perplexity-data"

type Props = {
  item: Item
  variant: "model" | "feature" | "log"
}

const labels: Record<Props["variant"], string> = {
  model: "モデル",
  feature: "機能",
  log: "実証ログ",
}

export function InfoCard({ item, variant }: Props) {
  return (
    <article className="glass glow-hover group relative flex flex-col rounded-2xl p-6">
      <header className="mb-5 flex items-start justify-between gap-3">
        <h3 className="font-heading text-pretty text-lg font-bold leading-snug text-foreground transition-colors group-hover:text-gold">
          {item.name}
        </h3>
        <div className="flex shrink-0 items-center gap-1.5">
          {item.tag && (
            <span className="rounded-full border border-[rgba(201,168,76,0.35)] bg-[rgba(201,168,76,0.08)] px-2 py-0.5 text-[11px] font-medium text-gold">
              {item.tag}
            </span>
          )}
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] font-medium tracking-wide text-muted-foreground">
            {labels[variant]}
          </span>
        </div>
      </header>

      <div className="mb-4 h-px w-full gold-hairline opacity-60" />

      <div>
        <p className="mb-1.5 text-xs font-medium tracking-wide text-gold/80">
          向いてる用途
        </p>
        <p className="text-pretty text-[15px] leading-relaxed text-foreground/90">
          {item.use}
        </p>
      </div>

      {item.point && (
        <div className="mt-4 rounded-xl border border-[rgba(201,168,76,0.2)] bg-[rgba(201,168,76,0.05)] p-3">
          <div className="mb-1.5 flex items-center gap-1.5">
            <Lightbulb className="size-4 shrink-0 text-gold" aria-hidden="true" />
            <span className="text-xs font-semibold tracking-wide text-gold">
              ポイント
            </span>
          </div>
          <p className="text-pretty text-sm leading-relaxed text-foreground/85">
            {item.point}
          </p>
        </div>
      )}

      <div className="mt-4">
        <div className="mb-1.5 flex items-center gap-1.5 text-muted-foreground">
          <Info className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="text-xs font-medium tracking-wide">気をつける点</span>
        </div>
        <p className="text-pretty text-[13px] leading-relaxed text-muted-foreground">
          {item.demerit}
        </p>
      </div>
    </article>
  )
}
