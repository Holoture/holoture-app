'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export default function ReferCopyButton({ link }: { link: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard API unavailable — nothing to do, the link is still selectable text
    }
  }

  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity shrink-0"
      style={{ backgroundColor: '#009BFF', color: 'white' }}
    >
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      {copied ? 'Copied' : 'Copy Link'}
    </button>
  )
}
