import type { Metadata } from "next"
export const metadata: Metadata = { title: "秘密の部屋 | 翻訳王", robots: { index: false, follow: false }, referrer: "no-referrer" }
export default function RoomLayout({ children }: { children: React.ReactNode }) { return children }
