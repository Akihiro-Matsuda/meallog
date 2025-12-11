'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'

type User = { id: string; email?: string }

export default function Home() {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser((data.user as any) ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser((session?.user as any) ?? null)
    })
    return () => { sub.subscription.unsubscribe() }
  }, [])

  const signOut = async () => { await supabase.auth.signOut() }

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-slate-50">
      <div className="mx-auto max-w-xl px-5 py-6 space-y-4">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-amber-700 font-semibold">meallog</p>
            <h1 className="text-2xl font-bold text-slate-900">ホーム</h1>
          </div>
          {user && (
            <button
              onClick={signOut}
              className="text-sm text-slate-600 underline decoration-amber-500 decoration-2 underline-offset-4"
            >
              サインアウト
            </button>
          )}
        </div>

      {user ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-white/80 p-4 shadow-sm">
            <p className="text-sm text-slate-600">ログイン中</p>
            <p className="text-base font-semibold text-slate-900 truncate">{user.email ?? user.id}</p>
          </div>

          <section className="space-y-3">
            <div className="rounded-xl bg-amber-500 text-white p-4 shadow-md">
              <p className="text-sm opacity-90">最優先アクション</p>
              <div className="mt-3 space-y-2">
                <Link
                  href="/meals/new"
                  className="block w-full rounded-lg bg-white/15 px-4 py-3 text-center font-semibold backdrop-blur hover:bg-white/25 transition"
                >
                  食事を記録する
                </Link>
                <Link
                  href="/meals"
                  className="block w-full rounded-lg bg-white/10 px-4 py-3 text-center font-medium backdrop-blur hover:bg-white/20 transition"
                >
                  記録一覧を見る
                </Link>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800">日次の入力</h2>
                <span className="text-[11px] text-amber-700 font-semibold">DAILY</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Link href="/surveys/wake" className="rounded-lg border border-slate-200 px-4 py-3 text-left hover:border-amber-400 transition">
                  <p className="text-sm font-semibold text-slate-900">起床アンケート</p>
                  <p className="text-xs text-slate-600 mt-1">起きた後に記録</p>
                </Link>
                <Link href="/surveys/bed" className="rounded-lg border border-slate-200 px-4 py-3 text-left hover:border-amber-400 transition">
                  <p className="text-sm font-semibold text-slate-900">就寝アンケート</p>
                  <p className="text-xs text-slate-600 mt-1">寝る前に記録</p>
                </Link>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800">設定</h2>
                <span className="text-[11px] text-slate-500 font-semibold">PREFERENCES</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Link href="/notifications" className="rounded-lg border border-slate-200 px-4 py-3 text-left hover:border-amber-400 transition">
                  <p className="text-sm font-semibold text-slate-900">通知設定</p>
                  <p className="text-xs text-slate-600 mt-1">リマインドを管理</p>
                </Link>
                <Link href="/profile" className="rounded-lg border border-slate-200 px-4 py-3 text-left hover:border-amber-400 transition">
                  <p className="text-sm font-semibold text-slate-900">プロフィール</p>
                  <p className="text-xs text-slate-600 mt-1">タイムゾーンなど</p>
                </Link>
              </div>
            </div>
          </section>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-white/80 p-4 shadow-sm space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">ログインが必要です</h2>
          <p className="text-sm text-slate-700">記録を始めるにはメールリンクでサインインしてください。</p>
          <Link className="block text-center rounded-lg bg-amber-500 text-white px-4 py-3 font-semibold hover:bg-amber-600 transition" href="/sign-in">
            サインインへ
          </Link>
        </div>
      )}
      </div>
    </main>
  )
}
