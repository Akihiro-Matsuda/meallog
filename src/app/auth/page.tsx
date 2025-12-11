'use client';

export const dynamic = 'force-dynamic'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'

function AuthPageInner() {
  const router = useRouter()
  const params = useSearchParams()
  const redirectTo = params.get('redirect') || '/admin/analysis'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const syncSession = async (event: string, session: any) => {
    try {
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ event, session }),
        credentials: 'same-origin',
        cache: 'no-store',
      })
    } catch {
      // best-effort
    }
  }

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setMsg(null)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setLoading(false)
      setMsg(error.message)
      return
    }

    const session = data?.session ?? (await supabase.auth.getSession()).data.session
    await syncSession('SIGNED_IN', session)

    setLoading(false)
    router.replace(redirectTo)
  }

  async function signOut() {
    await supabase.auth.signOut()
    await syncSession('SIGNED_OUT', null)
    setMsg('Signed out')
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-slate-50">
      <div className="mx-auto max-w-md px-5 py-8 space-y-6">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-amber-700 font-semibold">admin</p>
          <h1 className="text-2xl font-bold text-slate-900">MealLog MVP</h1>
          <p className="text-sm text-slate-600">
            管理者用のサインイン。メールとパスワードを入力してください。
          </p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-white/80 p-5 shadow-sm space-y-4">
          <form onSubmit={signInWithPassword} className="space-y-4">
            <label className="block text-sm font-medium text-slate-800">
              メールアドレス
              <input
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
            </label>
            <label className="block text-sm font-medium text-slate-800">
              パスワード
              <input
                type="password"
                placeholder="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-amber-500 text-white px-4 py-3 font-semibold hover:bg-amber-600 disabled:opacity-60 transition"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <button
            type="button"
            onClick={signOut}
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-amber-400 transition"
          >
            Sign out
          </button>

          {msg && <p className="text-sm text-red-600">{msg}</p>}
          <p className="text-xs text-slate-600">
            After sign-in you will be redirected to: <code>{redirectTo}</code>
          </p>
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

export default function AuthPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Loading…</div>}>
      <AuthPageInner />
    </Suspense>
  )
}
