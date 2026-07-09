import { quickRules } from "@/lib/perplexity-data"

export function QuickRules() {
  return (
    <section aria-labelledby="quick-rules-title" className="relative">
      <div className="mb-8 flex flex-col items-center text-center">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-[rgba(201,168,76,0.3)] bg-[rgba(201,168,76,0.06)] px-4 py-1.5 text-xs font-medium tracking-widest text-gold">
          かんたんガイド
        </span>
        <h2
          id="quick-rules-title"
          className="font-heading text-balance text-4xl font-black leading-tight tracking-tight text-foreground sm:text-5xl"
        >
          迷ったら、コレ。
        </h2>
        <p className="mt-4 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
          シーンに合わせて選ぶだけ。まずはこの5つを覚えれば充分。
        </p>
      </div>

      <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {quickRules.map((rule, i) => (
          <li
            key={rule.when}
            className="glass glow-hover group relative flex flex-col gap-4 rounded-2xl p-6"
          >
            <span className="font-mono text-xs tracking-widest text-gold/60">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="text-sm text-muted-foreground">{rule.when}</span>
            <span className="mt-auto text-pretty text-xl font-bold leading-tight text-foreground transition-colors group-hover:text-gold">
              {rule.pick}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
