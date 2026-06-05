import { SignIn } from '@clerk/nextjs'
import Image from 'next/image'
import Link from 'next/link'

export default function SignInPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      <div className="mb-8 flex flex-col items-center gap-3">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="Holoture"
            width={36}
            height={36}
            style={{ borderRadius: '4px' }}
          />
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
          variables: {
            colorBackground:              '#0F0F0F',
            colorText:                    '#FFFFFF',
            colorTextSecondary:           '#CCCCCC',
            colorTextOnPrimaryBackground: '#FFFFFF',
            colorInputBackground:         '#1A1A1A',
            colorInputText:               '#FFFFFF',
            colorPrimary:                 '#009BFF',
            colorNeutral:                 '#FFFFFF',
            borderRadius:                 '12px',
          },
          elements: {
            card: {
              backgroundColor: '#111111',
              border:          '1px solid rgba(255,255,255,0.10)',
              boxShadow:       '0 20px 60px rgba(0,0,0,0.50)',
            },
            socialButtonsBlockButton: {
              backgroundColor: '#1A1A1A',
              border:          '1px solid rgba(255,255,255,0.12)',
            },
            formFieldInput: {
              backgroundColor: '#1A1A1A',
              border:          '1px solid rgba(255,255,255,0.12)',
            },
            dividerLine: { backgroundColor: 'rgba(255,255,255,0.10)' },
            dividerText: { color: '#B0B8C4' },
            headerSubtitle: { color: '#B0B8C4' },
            formFieldLabel: { color: '#C8D0DA' },
            identityPreviewText: { color: '#B0B8C4' },
            footerActionText: { color: '#B0B8C4' },
          },
        }}
      />
    </div>
  )
}
