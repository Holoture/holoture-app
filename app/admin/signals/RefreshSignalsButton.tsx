'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

type Status = 'idle' | 'loading' | 'success' | 'error'

type Result = {
  count?: number
  largeCap?: number
  smallCap?: number
  skipped?: boolean
  error?: string
}

export default function RefreshSignalsButton() {
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<Result | null>(null)
  const router = useRouter()

  async function handleRefresh() {
    if (status === 'loading') return
    setStatus('loading')
    setResult(null)
    try {
      const res = await fetch('/api/admin/refresh-signals', { method: 'POST' })
      const data: Result & { ok?: boolean; error?: string } = await res.json()
      if (res.ok && data.ok !== false) {
        setResult({ count: data.count, largeCap: data.largeCap, smallCap: data.smallCap, skipped: data.skipped })
        setStatus('success')
        router.refresh()
      } else {
        setResult({ error: data.error ?? 'Unknown error' })
        setStatus('error')
      }
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : 'Network error' })
      setStatus('error')
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        onClick={handleRefresh}
        disabled={status === 'loading'}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        style={{ backgroundColor: '#a78bfa', color: 'white' }}
      >
        <RefreshCw className={`w-4 h-4 ${status === 'loading' ? 'animate-spin' : ''}`} />
        {status === 'loading' ? 'Refreshing…' : 'Refresh Signals Now'}
      </button>

      {status === 'success' && result && (
        <p className="flex items-center gap-1.5 text-xs" style={{ color: '#4ade80' }}>
          <CheckCircle className="w-3 h-3 shrink-0" />
          {result.skipped
            ? 'All tickers already have fresh signals — skipped'
            : `Generated ${result.count} signals (${result.largeCap} large cap · ${result.smallCap} small cap)`}
        </p>
      )}

      {status === 'error' && result?.error && (
        <p className="flex items-center gap-1.5 text-xs" style={{ color: '#f87171' }}>
          <AlertCircle className="w-3 h-3 shrink-0" />
          {result.error}
        </p>
      )}
    </div>
  )
}
