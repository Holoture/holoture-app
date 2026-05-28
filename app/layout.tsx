import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import Script from 'next/script'
import ThemeProvider from '@/components/ThemeProvider'
import Footer from '@/components/Footer'
import './globals.css'

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
      <html lang="en" className="h-full">
        <head>
          <link rel="icon" href="/favicon.ico" sizes="any" />
          <link rel="icon" href="/favicon.png?v=2" type="image/png" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        </head>
        <body className="min-h-full flex flex-col antialiased">
          <Script
            id="theme-init"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{
              __html: `(function(){try{var t=localStorage.getItem('theme');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark')}catch(e){}})()`,
            }}
          />
          <ThemeProvider>{children}</ThemeProvider>
          <Footer />
        </body>
      </html>
    </ClerkProvider>
  )
}
