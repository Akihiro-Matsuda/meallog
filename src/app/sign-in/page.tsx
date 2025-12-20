'use client'

export const dynamic = 'force-dynamic'

import { useRef, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function SignInInner() {
  const router = useRouter()
  const params = useSearchParams()
  const redirect = params.get('redirect') || '/'
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [codeDigits, setCodeDigits] = useState<string[]>(['', '', '', '', '', ''])
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const inputsRef = useRef<Array<HTMLInputElement | null>>([])

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    setError(null)
    const redirectTo = `${window.location.origin}/auth/callback`
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    })
    setSending(false)
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setVerifying(true)
    setError(null)
    const code = codeDigits.join('')
    if (!email || code.length !== 6) {
      setError('メールアドレスと6桁コードを入力してください。')
      setVerifying(false)
      return
    }
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    })
    if (error) {
      setError(error.message)
    } else {
      setError(null)
      router.replace(redirect)
    }
    setVerifying(false)
  }

  const handleCodeChange = (idx: number, value: string) => {
    const val = value.replace(/\D/g, '').slice(0, 1)
    const next = [...codeDigits]
    next[idx] = val
    setCodeDigits(next)
    if (val && idx < inputsRef.current.length - 1) {
      inputsRef.current[idx + 1]?.focus()
    }
  }

  const handleCodeKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !codeDigits[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus()
    }
    if (e.key === 'ArrowLeft' && idx > 0) inputsRef.current[idx - 1]?.focus()
    if (e.key === 'ArrowRight' && idx < inputsRef.current.length - 1) inputsRef.current[idx + 1]?.focus()
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!text) return
    const next = [...codeDigits]
    text.split('').forEach((ch, i) => {
      if (i < next.length) next[i] = ch
    })
    setCodeDigits(next)
    const focusIdx = Math.min(text.length, 5)
    inputsRef.current[focusIdx]?.focus()
    e.preventDefault()
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
              disabled={sending}
              className="w-full rounded-lg bg-amber-500 text-white px-4 py-3 font-semibold hover:bg-amber-600 disabled:opacity-60 transition"
            >
              {sending ? '送信中…' : 'ログインコードを送る'}
            </button>
          </form>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-800">メールの6桁コードを入力</p>
            <form onSubmit={handleVerifyCode} className="space-y-3">
              <div className="flex justify-between gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <input
                    key={i}
                    ref={(el) => { inputsRef.current[i] = el }}
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    maxLength={1}
                    value={codeDigits[i]}
                    onChange={(e) => handleCodeChange(i, e.target.value)}
                    onKeyDown={(e) => handleCodeKeyDown(i, e)}
                    onPaste={handlePaste}
                    className="w-12 h-12 text-center text-lg font-semibold text-slate-900 rounded-lg border border-slate-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  />
                ))}
              </div>
              <button
                type="submit"
                disabled={verifying || codeDigits.join('').length !== 6 || !email}
                className="w-full rounded-lg bg-slate-900 text-white px-4 py-3 font-semibold hover:bg-slate-800 disabled:opacity-60 transition"
              >
                {verifying ? '確認中…' : 'コードでログイン'}
              </button>
            </form>
          </div>

          {sent && !error && (
            <p className="text-sm text-green-700">メールを送信しました。届いた6桁コードを入力してください。</p>
          )}
          {error && <p className="text-red-600 text-sm">{error}</p>}
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

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading…</div>}>
      <SignInInner />
    </Suspense>
  )
}
