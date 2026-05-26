import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

export const metadata: Metadata = {
  title: 'Holoture — AI Stock Signals',
  description: 'AI-powered stock signal and investment insight platform. Get curated buy/sell signals with entry zones, confidence scores, and time horizons.',
  keywords: 'stock signals, AI investing, stock picks, investment insights',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en" className="h-full">
        <body className="min-h-full flex flex-col antialiased">{children}</body>
      </html>
    </ClerkProvider>
  )
}
