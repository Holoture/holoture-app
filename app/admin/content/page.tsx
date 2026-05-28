import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Header from '@/components/Header'
import AdminContentTabs from '@/components/AdminContentTabs'

export default async function AdminContentPage() {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_USER_ID) redirect('/dashboard')

  return (
    <>
      <Header />
      <AdminContentTabs />
    </>
  )
}
