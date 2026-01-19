'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import { HomeInlineButton } from '@/components/HomeInlineButton'

type Profile = {
  user_id: string
  timezone: string
  breakfast_time: string | null
  lunch_time: string | null
  dinner_time: string | null
  wakeup_time?: string | null
  bed_time?: string | null
}

function toDbTime(t: string | null): string | null {
  // <input type="time"> は "HH:MM" なので "HH:MM:00" に整形
  if (!t) return null
  return t.length === 5 ? `${t}:00` : t
}

function fromDbTime(t: string | null): string {
  // DB "HH:MM:SS" → input "HH:MM"
  if (!t) return ''
  return t.slice(0,5)
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [timezone, setTimezone] = useState('Asia/Tokyo')
  const [breakfast, setBreakfast] = useState('')
  const [lunch, setLunch] = useState('')
  const [dinner, setDinner] = useState('')
  const [wakeup, setWakeup] = useState('')
  const [bed, setBed] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setErr(null)
      const { data: userData } = await supabase.auth.getUser()
      const u = userData?.user
      if (!u) {
        setLoading(false)
        return
      }
      setUserId(u.id)
      setUserEmail(u.email ?? u.id)

      // 自分のprofiles行を取得（無ければあとでupsert）
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, timezone, breakfast_time, lunch_time, dinner_time, wakeup_time, bed_time')
        .eq('user_id', u.id)
        .maybeSingle()

      if (error) {
        setErr(error.message)
      } else if (data) {
        setTimezone(data.timezone ?? 'Asia/Tokyo')
        setBreakfast(fromDbTime(data.breakfast_time))
        setLunch(fromDbTime(data.lunch_time))
        setDinner(fromDbTime(data.dinner_time))
        setWakeup(fromDbTime((data as any).wakeup_time ?? null))
        setBed(fromDbTime((data as any).bed_time ?? null))
      }
      setLoading(false)
    })()
  }, [])

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    setSaving(true)
    setMsg(null)
    setErr(null)
    const payload: Profile = {
      user_id: userId,
      timezone,
      breakfast_time: toDbTime(breakfast),
      lunch_time: toDbTime(lunch),
      dinner_time: toDbTime(dinner),
      wakeup_time: toDbTime(wakeup),
      bed_time: toDbTime(bed),
    }
    const { error } = await supabase.from('profiles').upsert(payload)
    setSaving(false)
    if (error) setErr(error.message)
    else setMsg('保存しました')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-600">読み込み中…</p>
      </main>
    )
  }

  if (!userId) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-slate-50">
        <div className="mx-auto max-w-xl px-5 py-8 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900">プロフィール設定</h1>
            <HomeInlineButton />
          </div>
          <p className="text-sm text-slate-700">サインインしてプロフィールを管理してください。</p>
          <Link href="/sign-in" className="inline-flex justify-center rounded-lg bg-amber-500 text-white px-4 py-3 font-semibold hover:bg-amber-600 transition">
            サインインへ
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-slate-50">
      <div className="mx-auto max-w-xl px-5 py-6 space-y-5">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-amber-700 font-semibold">settings</p>
              <h1 className="text-2xl font-bold text-slate-900">プロフィール設定</h1>
            </div>
            <HomeInlineButton />
          </div>
          <p className="text-sm text-slate-700">ログイン: {userEmail}</p>
        </div>

        <form onSubmit={onSave} className="space-y-4 rounded-2xl border border-amber-200 bg-white/90 p-4 shadow-sm">
          <div className="space-y-4">
            <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm space-y-2">
              <p className="text-sm font-semibold text-slate-800">タイムゾーン</p>
              <label className="block text-sm font-medium text-slate-800">
                <input
                  type="text"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  placeholder="Asia/Tokyo"
                />
              </label>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm space-y-2">
              <p className="text-sm font-semibold text-slate-800">起床・就寝の通知時刻</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-slate-800">
                  起床通知時刻
                  <input
                    type="time"
                    value={wakeup}
                    onChange={(e) => setWakeup(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-800">
                  就寝通知時刻
                  <input
                    type="time"
                    value={bed}
                    onChange={(e) => setBed(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  />
                </label>
              </div>
              <p className="text-xs text-slate-700">未設定のスロットには通知を送りません。</p>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm space-y-2">
              <p className="text-sm font-semibold text-slate-800">食事リマインド時刻</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block text-sm font-medium text-slate-800">
                  朝食時刻
                  <input
                    type="time"
                    value={breakfast}
                    onChange={(e) => setBreakfast(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-800">
                  昼食時刻
                  <input
                    type="time"
                    value={lunch}
                    onChange={(e) => setLunch(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-800">
                  夕食時刻
                  <input
                    type="time"
                    value={dinner}
                    onChange={(e) => setDinner(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  />
                </label>
              </div>
              <p className="text-xs text-slate-700">未設定の食事時間にはリマインドを送りません。</p>
            </div>
          </div>

          <div className="space-y-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-amber-500 text-white px-4 py-3 font-semibold hover:bg-amber-600 disabled:opacity-60 transition"
            >
              {saving ? '保存中…' : '保存する'}
            </button>
            {msg && <p className="text-green-700 text-sm">{msg}</p>}
            {err && <p className="text-red-700 text-sm">{err}</p>}
          </div>
        </form>
      </div>
    </main>
  )
}
