'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'

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
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-slate-50">
      <div className="mx-auto max-w-md px-5 py-8 space-y-6">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-amber-700 font-semibold">signin</p>
          <h1 className="text-2xl font-bold text-slate-900">メールでサインイン</h1>
          <p className="text-sm text-slate-600">
            メールに届くリンクを開いてログインしてください。
          </p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-white/80 p-5 shadow-sm space-y-4">
          {sent ? (
            <div className="space-y-2">
              <p className="text-base font-semibold text-slate-900">送信しました</p>
              <p className="text-sm text-slate-700">メールのリンクを開いてください。</p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="w-full rounded-lg border border-amber-300 bg-white px-4 py-3 text-sm font-semibold text-amber-700 hover:bg-amber-50 transition"
              >
                別のメールで送る
              </button>
            </div>
          ) : (
            <form onSubmit={handleSendLink} className="space-y-4">
              <label className="block text-sm font-medium text-slate-800">
                メールアドレス
                <input
                  type="email"
                  required
                  inputMode="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </label>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-amber-500 text-white px-4 py-3 font-semibold hover:bg-amber-600 disabled:opacity-60 transition"
              >
                {loading ? '送信中…' : 'ログインリンクを送る'}
              </button>
              {error && <p className="text-red-600 text-sm">{error}</p>}
            </form>
          )}
        </div>

        <div className="text-center">
          <Link href="/" className="text-sm text-slate-600 underline decoration-amber-500 decoration-2 underline-offset-4">
            ホームに戻る
          </Link>
        </div>
      </div>
    </main>
  )
}
