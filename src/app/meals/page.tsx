'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
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

  useEffect(() => {
    ;(async () => {
      setErr(null)
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
    })()
  }, [])

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-5">
      <h1 className="text-2xl font-semibold">食事の記録一覧</h1>

      <div className="flex gap-3">
        <Link href="/meals/new" className="rounded bg-black text-white px-3 py-2">新規記録</Link>
        <Link href="/" className="rounded border px-3 py-2">ホームへ</Link>
      </div>

      {err && <p className="text-red-700">{err}</p>}

      <ul className="space-y-3">
        {rows.map(r => (
          <li key={r.id} className="rounded border p-3 flex gap-3 items-center">
            {r.signed_url ? (
              <img src={r.signed_url} alt="" className="w-20 h-20 object-cover rounded" />
            ) : (
              <div className="w-20 h-20 bg-gray-100 rounded" />
            )}
            <div>
              <div className="text-sm text-gray-600">#{r.id} / {r.meal_slot}</div>
              <div className="font-medium">{new Date(r.taken_at).toLocaleString()}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}