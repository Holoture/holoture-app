'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ToggleLeft, ToggleRight } from 'lucide-react'

export default function SignalToggleButton({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter()
  const [active, setActive] = useState(isActive)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    const res = await fetch(`/api/signals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !active }),
    })
    if (res.ok) setActive(!active)
    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="flex items-center gap-1.5 text-xs font-medium transition-opacity disabled:opacity-50"
      style={{ color: active ? '#14b8a6' : '#94a3b8' }}
      title={active ? 'Deactivate' : 'Activate'}
    >
      {active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
      {active ? 'Active' : 'Inactive'}
    </button>
  )
}
