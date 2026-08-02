import type { Metadata } from 'next'

// page.tsx here is a client component ('use client', for the accordion/search
// UI), so it can't export metadata itself — this layout carries it instead.
export const metadata: Metadata = {
  title: 'Learn - Holoture',
  description: 'Educational articles on stock signals, risk management, entry zones, congressional trading, insider buying, and how to use Holoture — from beginner to advanced.',
  openGraph: {
    title: 'Learn - Holoture',
    description: 'Educational articles on stock signals, risk management, entry zones, congressional trading, insider buying, and how to use Holoture — from beginner to advanced.',
  },
  twitter: {
    title: 'Learn - Holoture',
    description: 'Educational articles on stock signals, risk management, entry zones, congressional trading, insider buying, and how to use Holoture — from beginner to advanced.',
  },
}

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return children
}
