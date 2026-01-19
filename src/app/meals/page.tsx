'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { HomeInlineButton } from '@/components/HomeInlineButton'
import { supabase } from '@/lib/supabaseClient'

type Row = {
  id: number
  meal_slot: string
  taken_at: string
  image_path: string | null
  preview_path: string | null
  signed_url?: string | null
}

export default function MealsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      setErr(null); setLoading(true)
      const { data, error } = await supabase
        .from('meals')
        .select(`
          id, meal_slot, taken_at,
          meal_images ( storage_path, preview_path )
        `)
        .order('taken_at', { ascending: false })
        .limit(20)

      if (error) { setErr(error.message); return }

      const rows: Row[] = (data ?? []).map((m: any) => ({
        id: m.id,
        meal_slot: m.meal_slot,
        taken_at: m.taken_at,
        image_path: m.meal_images?.[0]?.storage_path ?? null,
        preview_path: m.meal_images?.[0]?.preview_path ?? null,
      }))

      const withSigned = await Promise.all(rows.map(async r => {
        const path = r.preview_path || r.image_path
        if (!path) return r
        const { data, error } = await supabase.storage.from('meal-images').createSignedUrl(path, 60)
        return { ...r, signed_url: error ? null : data?.signedUrl ?? null }
      }))

      setRows(withSigned)
      setLoading(false)
    })()
  }, [])

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-slate-50">
      <div className="mx-auto max-w-2xl px-5 py-6 space-y-5">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-amber-700 font-semibold">meals</p>
            <h1 className="text-2xl font-bold text-slate-900">食事の記録一覧</h1>
            <p className="text-sm text-slate-600">撮影した食事を確認できます。タップで詳しく表示。</p>
          </div>
          <HomeInlineButton />
        </div>

        {err && <p className="text-red-700 text-sm">{err}</p>}

        <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
          {loading ? (
            <p className="text-sm text-slate-600">読み込み中…</p>
          ) : rows.length === 0 ? (
            <div className="text-center space-y-2 py-6">
              <p className="text-sm text-slate-700">まだ記録がありません。</p>
              <Link href="/meals/new" className="inline-block rounded-lg bg-amber-500 text-white px-4 py-2 font-semibold hover:bg-amber-600 transition">
                食事を記録する
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {rows.map(r => (
                <li key={r.id} className="rounded-xl border border-slate-200 p-3 flex gap-3 items-center bg-white hover:border-amber-300 transition">
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                    {r.signed_url ? (
                      <img src={r.signed_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-800 font-semibold">{r.meal_slot}</span>
                      <span className="text-slate-500">#{r.id}</span>
                    </div>
                    <div className="font-semibold text-slate-900 truncate mt-1">
                      {new Date(r.taken_at).toLocaleString()}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  )
}
