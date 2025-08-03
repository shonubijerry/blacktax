'use client'

import LoadingSpinner from '@/components/LoadingSpinner'
import { signIn, useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'

export default function LoginPage() {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return <LoadingSpinner />
  }

  if (session) {
    redirect('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={() => signIn('zoho', { callbackUrl: '/' })}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Sign in with Zoho
        </button>
      </div>
    </div>
  )
}
