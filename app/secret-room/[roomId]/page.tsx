"use client"
import { useParams } from "next/navigation"
import TranslationStudio from "@/components/translator/studio"
export default function SecretRoomPage() {
  const params = useParams<{ roomId: string }>()
  return <TranslationStudio key={params.roomId} roomId={params.roomId} />
}
