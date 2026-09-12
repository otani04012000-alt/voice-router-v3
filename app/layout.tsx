import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import '@fontsource-variable/noto-sans-jp'
import '@fontsource-variable/noto-serif-jp'
import '@fontsource-variable/noto-sans-khmer'
import './globals.css'

export const metadata: Metadata = {
  title: '翻訳王 | ことばの向こうに、人がいる。',
  description: '日本語・ベトナム語・クメール語・英語をつなぐ会話通訳。声で入力し、訳文を見せて、ふたりの会話を続けよう。',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="ja"
      className="dark font-variables bg-background"
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
