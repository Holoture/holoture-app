import { SignIn } from '@clerk/nextjs'
import { TrendingUp } from 'lucide-react'
import Link from 'next/link'

export default function SignInPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      <div className="mb-8 flex flex-col items-center gap-3">
        <Link href="/" className="flex items-center gap-2">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: '#009BFF' }}
          >
            <TrendingUp className="w-6 h-6" style={{ color: 'white' }} />
          </div>
          <span className="text-2xl font-black text-white">
            Holo<span style={{ color: '#009BFF' }}>ture</span>
          </span>
        </Link>
        <p className="text-sm" style={{ color: '#94a3b8' }}>
          Sign in to access your signal board
        </p>
      </div>
      <SignIn
        appearance={{
          elements: {
            card: 'bg-navy-800 border border-navy-600 shadow-xl',
            headerTitle: 'text-white',
            headerSubtitle: 'text-slate-400',
            socialButtonsBlockButton:
              'bg-navy-700 border border-navy-600 text-white hover:bg-navy-600',
            dividerLine: 'bg-navy-600',
            dividerText: 'text-slate-400',
            formFieldLabel: 'text-slate-300',
            formFieldInput:
              'bg-navy-950 border border-navy-600 text-white placeholder:text-slate-500',
            formButtonPrimary: 'bg-teal-500 hover:bg-teal-600',
            footerActionLink: 'text-teal-400 hover:text-teal-300',
          },
          variables: {
            colorBackground: '#1a1a1a',
            colorText: '#e2e8f0',
            colorPrimary: '#009BFF',
            colorInputBackground: '#0a0a0a',
            colorInputText: '#e2e8f0',
            borderRadius: '12px',
          },
        }}
      />
    </div>
  )
}
