'use client'

import { signIn } from 'next-auth/react'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="flex flex-col items-center gap-4 mt-12">
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
