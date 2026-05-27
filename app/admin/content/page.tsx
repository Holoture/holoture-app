import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Header from '@/components/Header'
import ContentDashboard from '@/components/ContentDashboard'

export default async function AdminContentPage() {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_USER_ID) redirect('/dashboard')

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <ContentDashboard />
    </div>
  )
}
