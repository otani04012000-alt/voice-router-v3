import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)

  const provider = body?.provider ?? "Unknown"
  const prompt = body?.prompt ?? ""
  const voice = body?.voice ?? {}
  const reason = body?.reason ?? "no reason"
  const confidence = body?.confidence ?? 0
  const scores = body?.scores ?? {}

  return NextResponse.json({
    reply: `MOCK ${provider}: 「${prompt}」を ${provider} に送る想定です。confidence:${confidence} / reason:${reason}`,
    provider,
    voice,
    reason,
    confidence,
    scores,
  })
}
