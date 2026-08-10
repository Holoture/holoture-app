import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getOrCreateUser } from '@/lib/user'
import { getOrCreateReferralCode, REFERRER_REWARD_CAP } from '@/lib/referral'
import Header from '@/components/Header'
import AuthLoadingGate from '@/components/AuthLoadingGate'
import ReferCopyButton from '@/components/ReferCopyButton'
import { Gift, Users, CheckCircle2, Clock } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Refer a Friend - Holoture',
  description: 'Invite a friend to Holoture — you both get a free month of Pro once they start a trial and stick around.',
}

const STATUS_STYLE: Record<string, { label: string; bg: string; text: string }> = {
  PENDING:   { label: 'Signed up',        bg: 'var(--bg-overlay)',           text: 'var(--text-mute)' },
  SIGNED_UP: { label: 'Trial started',    bg: 'rgba(245,158,11,0.15)',       text: '#fbbf24' },
  VALIDATED: { label: 'Converting…',      bg: 'rgba(0,155,255,0.15)',        text: '#009BFF' },
  REWARDED:  { label: 'Reward earned',    bg: 'rgba(74,222,128,0.15)',       text: '#4ade80' },
  EXPIRED:   { label: 'Did not convert',  bg: 'rgba(148,163,184,0.15)',      text: '#94a3b8' },
}

export default async function ReferPage() {
  const { userId } = await auth()
  if (!userId) return <AuthLoadingGate />

  const user = await getOrCreateUser()
  if (!user) redirect('/sign-in')

  const [code, referrals] = await Promise.all([
    getOrCreateReferralCode(userId),
    prisma.referral.findMany({ where: { referrerUserId: userId }, orderBy: { createdAt: 'desc' } }),
  ])

  const host = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.holoture.com'
  const link = `${host.replace(/\/$/, '')}/r/${code}`

  const rewardedCount = referrals.filter((r) => r.referrerRewardApplied).length
  const pendingCount = referrals.filter((r) => r.status === 'PENDING' || r.status === 'SIGNED_UP').length

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center gap-3 mb-1">
          <Gift className="w-6 h-6" style={{ color: '#009BFF' }} />
          <h1 className="text-2xl font-black text-white">Refer a Friend</h1>
        </div>
        <p className="text-sm mb-8" style={{ color: 'var(--text-w50)' }}>
          Share your link. Your friend gets a free month of Pro when they start a Pro trial and it converts to
          a paid subscription after the 7-day trial — not just for signing up. You get a free month too, once
          that happens.
        </p>

        {/* Link + copy */}
        <div className="rounded-2xl p-5 mb-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="flex-1 min-w-0 px-3 py-2.5 rounded-lg font-data text-sm text-white truncate" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
            {link}
          </div>
          <ReferCopyButton link={link} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="rounded-xl p-4 text-center" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <Users className="w-4 h-4 mx-auto mb-1.5" style={{ color: 'var(--text-w50)' }} />
            <p className="text-xl font-black text-white">{referrals.length}</p>
            <p className="text-xs" style={{ color: 'var(--text-w50)' }}>Invited</p>
          </div>
          <div className="rounded-xl p-4 text-center" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <Clock className="w-4 h-4 mx-auto mb-1.5" style={{ color: '#fbbf24' }} />
            <p className="text-xl font-black text-white">{pendingCount}</p>
            <p className="text-xs" style={{ color: 'var(--text-w50)' }}>In progress</p>
          </div>
          <div className="rounded-xl p-4 text-center" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <CheckCircle2 className="w-4 h-4 mx-auto mb-1.5" style={{ color: '#4ade80' }} />
            <p className="text-xl font-black text-white">{rewardedCount} / {REFERRER_REWARD_CAP}</p>
            <p className="text-xs" style={{ color: 'var(--text-w50)' }}>Rewards earned</p>
          </div>
        </div>

        {/* History */}
        <h2 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--text-w50)' }}>Your Invites</h2>
        {referrals.length === 0 ? (
          <div className="rounded-2xl p-10 text-center" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <p className="text-white font-semibold">No invites yet</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-w50)' }}>Share your link above to get started.</p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <table className="w-full text-sm">
              <tbody>
                {referrals.map((r, i) => {
                  const s = STATUS_STYLE[r.status] ?? STATUS_STYLE.PENDING
                  return (
                    <tr key={r.id} style={{ backgroundColor: i % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <td className="px-4 py-3 text-white">{r.refereeEmail}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-w50)' }}>
                        {r.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: s.bg, color: s.text }}>
                          {s.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
