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
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">MealLog MVP</h1>

      {user ? (
        <div className="space-y-3">
          <p>ログイン中: <span className="font-medium">{user.email ?? user.id}</span></p>

          {/* ← ここが“表示ブロック”。この下にリンクを追加します */}
          <div className="space-x-2">
            <Link className="rounded border px-3 py-2 inline-block" href="/profile">
              プロフィール設定へ
            </Link>
            <button className="rounded bg-black text-white px-3 py-2" onClick={signOut}>
              サインアウト
            </button>
            <Link className="rounded border px-3 py-2 inline-block" href="/meals/new">
              食事の記録
            </Link>
            <Link className="rounded border px-3 py-2 inline-block" href="/meals">
              記録一覧
            </Link>
            <Link className="rounded border px-3 py-2 inline-block" href="/notifications">
              通知設定
            </Link>
            <Link className="rounded border px-3 py-2 inline-block" href="/surveys/wake">
              起床アンケート
            </Link>
            <Link className="rounded border px-3 py-2 inline-block" href="/surveys/bed">
              就寝アンケート
            </Link>

          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p>まだログインしていません。</p>
          <Link className="rounded bg-black text-white px-3 py-2 inline-block" href="/sign-in">
            サインインへ
          </Link>
        </div>
      )}
    </main>
  )
}
