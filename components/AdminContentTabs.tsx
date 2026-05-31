'use client'

import { useState } from 'react'
import { Sparkles, ImageIcon, Video } from 'lucide-react'
import ContentDashboard from './ContentDashboard'
import VisualGenerator from './VisualGenerator'
import VideoEngine from './VideoEngine'

const TABS = [
  { id: 'content', label: 'Content Generator', icon: Sparkles },
  { id: 'visuals', label: 'Visual Generator',  icon: ImageIcon },
  { id: 'video',   label: 'Video Engine',       icon: Video    },
] as const

type TabId = (typeof TABS)[number]['id']

export default function AdminContentTabs() {
  const [activeTab, setActiveTab] = useState<TabId>('content')

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Tab bar */}
      <div style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className="flex items-center gap-2 px-5 py-3.5 text-sm font-semibold transition-colors relative"
                style={{
                  color: activeTab === id ? '#009BFF' : 'rgba(255,255,255,0.5)',
                  borderBottom: activeTab === id ? '2px solid #009BFF' : '2px solid transparent',
                  marginBottom: -1,
                }}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === 'content' && <ContentDashboard />}
      {activeTab === 'visuals' && <VisualGenerator />}
      {activeTab === 'video'   && <VideoEngine />}
    </div>
  )
}
