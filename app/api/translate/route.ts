import { NextResponse } from "next/server"

/**
 * 秘密の部屋 - 翻訳API
 *
 * 2つのペルソナを system prompt の切り替えだけで実現する。
 * - secretary（秘書）: 日本語話者向け。日本語→ベトナム語。自然な言い回し優先。
 * - concierge（コンシェルジュ）: ベトナム語話者向け。ベトナム語→日本語。温かい歓迎トーン。
 *
 * モデル呼び出しは OpenRouter 経由（1キーで Claude / GPT / Gemini を切り替え可能）。
 */

const PERSONAS = {
  secretary: {
    systemPrompt:
      "あなたはユーザー（日本語話者）専属の秘書です。丁寧に、意図を汲んで、日本語からベトナム語へ自然に訳してください。直訳ではなく、実際にベトナム語話者が使う言い回しを優先してください。返答は翻訳後の文章のみを返し、前置きや説明は一切つけないでください。",
  },
  concierge: {
    systemPrompt:
      "あなたは相手（ベトナム語話者）をもてなす専属コンシェルジュです。温かく、歓迎する調子で、ベトナム語から日本語へ訳してください。返答は翻訳後の文章のみを返し、前置きや説明は一切つけないでください。",
  },
} as const

type PersonaKey = keyof typeof PERSONAS

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
const MODEL = "anthropic/claude-sonnet-4.5"

export async function POST(req: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENROUTER_API_KEY is not configured on the server." },
      { status: 500 },
    )
  }

  const body = await req.json().catch(() => null)
  const persona = body?.persona as PersonaKey | undefined
  const text = typeof body?.text === "string" ? body.text.trim() : ""

  if (!persona || !(persona in PERSONAS)) {
    return NextResponse.json(
      { error: "persona must be 'secretary' or 'concierge'." },
      { status: 400 },
    )
  }
  if (!text) {
    return NextResponse.json({ error: "text is required." }, { status: 400 })
  }

  const { systemPrompt } = PERSONAS[persona]

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        temperature: 0.3,
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      return NextResponse.json(
        { error: `OpenRouter error: ${res.status} ${errText}` },
        { status: 502 },
      )
    }

    const data = await res.json()
    const translated = data?.choices?.[0]?.message?.content ?? ""

    return NextResponse.json({
      persona,
      original: text,
      translated,
    })
  } catch (err) {
    return NextResponse.json(
      { error: `Request failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    )
  }
}
