'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

export default function SignalDeleteButton({ id, ticker }: { id: string; ticker: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (!confirm(`Delete signal for ${ticker}? This cannot be undone.`)) return
    setLoading(true)
    await fetch(`/api/signals/${id}`, { method: 'DELETE' })
    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="p-1.5 rounded-lg transition-colors disabled:opacity-50"
      style={{ color: '#94a3b8' }}
      title="Delete signal"
    >
      <Trash2 className="w-4 h-4 hover:text-red-400" />
    </button>
  )
}
