import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Header from '@/components/Header'
import { prisma } from '@/lib/prisma'
import AlertsForm from '@/components/AlertsForm'
import { Bell } from 'lucide-react'

export default async function AlertsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const prefs = await prisma.alertPreferences.findUnique({ where: { clerkId: userId } })

  const initial = prefs
    ? {
        newSignalAlert: prefs.newSignalAlert,
        highConfidenceAlert: prefs.highConfidenceAlert,
        confidenceThreshold: prefs.confidenceThreshold,
        dailyDigest: prefs.dailyDigest,
        earningsWarning: prefs.earningsWarning,
        emailAlerts: prefs.emailAlerts,
      }
    : null

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#353535' }}>
      <Header />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <Bell className="w-6 h-6" style={{ color: '#009BFF' }} />
            <h1 className="text-2xl font-black text-white">Alert Preferences</h1>
          </div>
          <p className="text-sm text-white">Choose which notifications you want to receive and how</p>
        </div>

        <div className="rounded-2xl p-6 sm:p-8" style={{ backgroundColor: '#404040', border: '1px solid rgba(255,255,255,0.2)' }}>
          <AlertsForm initial={initial} />
        </div>
      </div>
    </div>
  )
}
