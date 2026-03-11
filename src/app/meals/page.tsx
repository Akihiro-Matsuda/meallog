'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { HomeInlineButton } from '@/components/HomeInlineButton'
import { supabase } from '@/lib/supabaseClient'

type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'drink'
type Row = {
  id: number
  meal_slot: MealSlot
  taken_at: string
  image_path: string | null
  preview_path: string | null
  signed_url?: string | null
}

const SLOT_OPTIONS: Array<{ value: MealSlot; label: string }> = [
  { value: 'breakfast', label: '朝食' },
  { value: 'lunch', label: '昼食' },
  { value: 'dinner', label: '夕食' },
  { value: 'snack', label: '軽食' },
  { value: 'drink', label: '飲み物' },
]

function normalizeMealSlot(value: unknown): MealSlot {
  if (value === 'breakfast' || value === 'lunch' || value === 'dinner' || value === 'snack' || value === 'drink') {
    return value
  }
  return 'snack'
}

export default function MealsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [slotDrafts, setSlotDrafts] = useState<Record<number, MealSlot>>({})
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const updateMealSlot = async (mealId: number, slot: MealSlot) => {
    setErr(null)
    setSavingId(mealId)
    try {
      const { error } = await supabase
        .from('meals')
        .update({ meal_slot: slot })
        .eq('id', mealId)
      if (error) throw error

      setRows((prev) => prev.map((r) => (r.id === mealId ? { ...r, meal_slot: slot } : r)))
      setSlotDrafts((prev) => {
        const next = { ...prev }
        delete next[mealId]
        return next
      })
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    } finally {
      setSavingId(null)
    }
  }

  const deleteMeal = async (mealId: number) => {
    setErr(null)
    setDeletingId(mealId)
    try {
      const ok = window.confirm('この記録を削除します。よろしいですか？')
      if (!ok) return

      const { data: imageRows, error: imgErr } = await supabase
        .from('meal_images')
        .select('storage_path, preview_path')
        .eq('meal_id', mealId)
      if (imgErr) throw imgErr

      const { data: deleted, error: delErr } = await supabase.rpc('delete_my_meal', { p_meal_id: mealId })
      if (delErr) throw delErr
      if (!deleted) throw new Error('削除対象が見つかりませんでした。')

      const toRemove = Array.from(new Set(
        (imageRows ?? [])
          .flatMap((r: any) => [r.storage_path, r.preview_path])
          .filter((v: unknown): v is string => typeof v === 'string' && v.length > 0)
      ))

      if (toRemove.length > 0) {
        const { error: rmErr } = await supabase.storage.from('meal-images').remove(toRemove)
        if (rmErr) {
          console.warn('storage cleanup failed:', rmErr.message)
        }
      }

      setRows((prev) => prev.filter((r) => r.id !== mealId))
      setSlotDrafts((prev) => {
        const next = { ...prev }
        delete next[mealId]
        return next
      })
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    } finally {
      setDeletingId(null)
    }
  }

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

      if (error) { setErr(error.message); setLoading(false); return }

      const rows: Row[] = (data ?? []).map((m: any) => ({
        id: m.id,
        meal_slot: normalizeMealSlot(m.meal_slot),
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
            <p className="text-sm text-slate-600">撮影した食事を確認できます。</p>
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
                      <span className="text-slate-500">カテゴリ</span>
                      <select
                        value={slotDrafts[r.id] ?? r.meal_slot}
                        onChange={(e) => {
                          const value = e.target.value as MealSlot
                          setSlotDrafts((prev) => ({ ...prev, [r.id]: value }))
                        }}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                      >
                        {SLOT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => updateMealSlot(r.id, slotDrafts[r.id] ?? r.meal_slot)}
                        disabled={savingId === r.id || deletingId === r.id || (slotDrafts[r.id] ?? r.meal_slot) === r.meal_slot}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:border-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        {savingId === r.id ? '保存中…' : '保存'}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMeal(r.id)}
                        disabled={savingId === r.id || deletingId === r.id}
                        className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        {deletingId === r.id ? '削除中…' : '削除'}
                      </button>
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
