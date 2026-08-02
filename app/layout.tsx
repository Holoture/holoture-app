import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { DM_Sans, JetBrains_Mono } from 'next/font/google'
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

const SITE_URL = 'https://www.holoture.com'
const SITE_TITLE = 'Holoture - Stocks, Options, Market Data'
const SITE_DESCRIPTION = 'Data-powered stock signal and investment insight platform. Get curated buy/sell signals with entry zones, confidence scores, and time horizons.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
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
  // Site-wide default — individual pages (pricing, learn, scanners) override
  // title/description via their own metadata export, which merges with this.
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Holoture',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: '/logo.png', width: 512, height: 512, alt: 'Holoture' }],
  },
  twitter: {
    card: 'summary',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/logo.png'],
  },
}

// Organization structured data (JSON-LD) — read by search engines and AI
// crawlers for entity/knowledge-graph context.
//
// NO foundingDate: no founding year is recorded anywhere in this codebase
// (checked copyright strings, footer, About content) and fabricating one
// would be exactly the kind of dishonest-looking-number this app avoids
// everywhere else (see the public track-record's sample-size discipline).
// Add a real foundingDate here once you have one to state.
const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Holoture',
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  description: SITE_DESCRIPTION,
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
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
          />
        </head>
        <body className="min-h-full flex flex-col antialiased">
          <SessionGuard>{children}</SessionGuard>
          <Footer />
        </body>
      </html>
    </ClerkProvider>
  )
}
