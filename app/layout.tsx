import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { DM_Sans, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SessionGuard } from '@/components/SessionGuard'
import Footer from '@/components/Footer'
import './globals.css'

// Primary UI / marketing copy font.
const dmSans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-dm-sans',
})

// Monospace font for numeric/data display (prices, %, tickers, timestamps).
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono-data',
})

export const metadata: Metadata = {
  title: 'Holoture — Data Stock Signals',
  description: 'Data-powered stock signal and investment insight platform. Get curated buy/sell signals with entry zones, confidence scores, and time horizons.',
  keywords: 'stock signals, data investing, stock picks, investment insights',
  icons: {
    icon: [
      { url: '/favicon.ico',     sizes: 'any' },
      { url: '/favicon.png?v=2', type: 'image/png', sizes: '32x32' },
      { url: '/logo.png',        type: 'image/png', sizes: '192x192' },
    ],
    shortcut: '/favicon.ico',
    apple:    '/apple-touch-icon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      <html lang="en" data-theme="dark" className={`h-full ${dmSans.variable} ${jetbrainsMono.variable}`}>
        <head>
          <link rel="icon" href="/favicon.ico" sizes="any" />
          <link rel="icon" href="/favicon.png?v=2" type="image/png" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        </head>
        <body className="min-h-full flex flex-col antialiased">
          <SessionGuard>{children}</SessionGuard>
          <Footer />
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  )
}
