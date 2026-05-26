import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/Header'
import SignalForm from '@/components/SignalForm'
import { ArrowLeft } from 'lucide-react'

export default async function NewSignalPage() {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_USER_ID) redirect('/dashboard')

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <Link href="/admin/signals" className="inline-flex items-center gap-2 text-sm mb-6 text-white hover:opacity-70 transition-opacity">
            <ArrowLeft className="w-4 h-4" /> Back to Signals
          </Link>
          <h1 className="text-2xl font-black text-white">Add New Signal</h1>
          <p className="text-sm mt-1 text-white">Create a new stock signal. It will be visible to users immediately upon saving.</p>
        </div>
        <div className="rounded-2xl p-6 sm:p-8" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <SignalForm />
        </div>
      </div>
    </div>
  )
}
