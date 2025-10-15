'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function AuthPage() {
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
    <main style={{ maxWidth: 360, margin: '64px auto', padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Sign in (Admin)</h1>

      <form onSubmit={signInWithPassword} style={{ display: 'grid', gap: 12, marginTop: 16 }}>
        <input
          type="email"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: 8, border: '1px solid #ccc', borderRadius: 8 }}
        />
        <input
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: 8, border: '1px solid #ccc', borderRadius: 8 }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{ padding: '10px 12px', borderRadius: 8, background: '#111', color: '#fff' }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <button onClick={signOut} style={{ marginTop: 12 }}>Sign out</button>

      {msg && <p style={{ marginTop: 12, color: 'crimson' }}>{msg}</p>}
      <p style={{ marginTop: 12, fontSize: 12, color: '#666' }}>
        After sign-in you will be redirected to: <code>{redirectTo}</code>
      </p>
    </main>
  )
}
