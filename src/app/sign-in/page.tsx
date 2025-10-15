'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const redirectTo = `${window.location.origin}/auth/callback`
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold mb-4">サインイン（メールリンク）</h1>
      {sent ? (
        <p className="p-3 rounded border">送信しました。メールのリンクを開いてください。</p>
      ) : (
        <form onSubmit={handleSendLink} className="space-y-4">
          <input
            type="email"
            required
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border p-2"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-black text-white py-2 disabled:opacity-50"
          >
            {loading ? '送信中…' : 'ログインリンクを送る'}
          </button>
          {error && <p className="text-red-600 text-sm">{error}</p>}
        </form>
      )}
    </div>
  )
}