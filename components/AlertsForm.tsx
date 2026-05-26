'use client'

import { useState } from 'react'
import { Bell, TrendingUp, Mail, BarChart3, CalendarDays, Zap } from 'lucide-react'

type Prefs = {
  newSignalAlert: boolean
  highConfidenceAlert: boolean
  confidenceThreshold: number
  dailyDigest: boolean
  earningsWarning: boolean
  emailAlerts: boolean
}

const SETTINGS: { key: keyof Prefs; icon: React.ElementType; label: string; description: string }[] = [
  { key: 'emailAlerts', icon: Mail, label: 'Email Alerts', description: 'Master toggle — receive all enabled alerts via email' },
  { key: 'newSignalAlert', icon: TrendingUp, label: 'New Signal Added', description: 'Get notified whenever a new signal is published to the board' },
  { key: 'highConfidenceAlert', icon: Zap, label: 'High-Confidence Signals', description: 'Alert only when a signal meets your confidence threshold' },
  { key: 'dailyDigest', icon: BarChart3, label: 'Daily Digest', description: 'Morning summary of all active signals and market overview' },
  { key: 'earningsWarning', icon: CalendarDays, label: 'Earnings Warnings', description: 'Alert 24h before an earnings event for any signal you hold' },
]

export default function AlertsForm({ initial }: { initial: Prefs | null }) {
  const defaults: Prefs = {
    newSignalAlert: true,
    highConfidenceAlert: true,
    confidenceThreshold: 75,
    dailyDigest: false,
    earningsWarning: true,
    emailAlerts: true,
  }

  const [prefs, setPrefs] = useState<Prefs>(initial ?? defaults)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function toggle(key: keyof Prefs) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    try {
      await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      })
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {SETTINGS.map(({ key, icon: Icon, label, description }) => (
          <div key={key} className="flex items-start gap-4 p-4 rounded-xl" style={{ backgroundColor: '#3a3a3a', border: '1px solid rgba(255,255,255,0.15)' }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(0,155,255,0.15)' }}>
              <Icon className="w-4 h-4" style={{ color: '#009BFF' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-white">{label}</p>
              <p className="text-xs text-white mt-0.5">{description}</p>
            </div>
            <button
              onClick={() => toggle(key as keyof Prefs)}
              className="relative shrink-0 w-11 h-6 rounded-full transition-colors"
              style={{ backgroundColor: prefs[key as keyof Prefs] ? '#009BFF' : 'rgba(255,255,255,0.15)' }}
              aria-label={`Toggle ${label}`}
            >
              <span
                className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow"
                style={{ transform: prefs[key as keyof Prefs] ? 'translateX(20px)' : 'translateX(0)' }}
              />
            </button>
          </div>
        ))}
      </div>

      {/* Confidence Threshold */}
      {prefs.highConfidenceAlert && (
        <div className="p-4 rounded-xl" style={{ backgroundColor: '#3a3a3a', border: '1px solid rgba(255,255,255,0.15)' }}>
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4" style={{ color: '#009BFF' }} />
            <p className="font-semibold text-sm text-white">Confidence Threshold: {prefs.confidenceThreshold}%</p>
          </div>
          <input
            type="range"
            min={50}
            max={95}
            step={5}
            value={prefs.confidenceThreshold}
            onChange={(e) => { setPrefs((p) => ({ ...p, confidenceThreshold: parseInt(e.target.value) })); setSaved(false) }}
            className="w-full accent-blue-500"
          />
          <div className="flex justify-between text-xs mt-1 text-white">
            <span>50% (More alerts)</span>
            <span>95% (Fewer alerts)</span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: '#009BFF' }}
        >
          {saving ? 'Saving…' : 'Save Preferences'}
        </button>
        {saved && (
          <p className="text-sm text-white" style={{ color: '#4ade80' }}>Preferences saved!</p>
        )}
      </div>
    </div>
  )
}
