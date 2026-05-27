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
      { url: '/logo.png', type: 'image/png' },
    ],
    shortcut: '/logo.png',
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
        <head>
          <link rel="icon" href="/logo.png" type="image/png" />
          <link rel="shortcut icon" href="/logo.png" type="image/png" />
          <link rel="apple-touch-icon" href="/logo.png" />
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
