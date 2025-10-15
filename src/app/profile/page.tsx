'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

type Profile = {
  user_id: string
  timezone: string
  breakfast_time: string | null
  lunch_time: string | null
  dinner_time: string | null
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
        .select('user_id, timezone, breakfast_time, lunch_time, dinner_time')
        .eq('user_id', u.id)
        .maybeSingle()

      if (error) {
        setErr(error.message)
      } else if (data) {
        setTimezone(data.timezone ?? 'Asia/Tokyo')
        setBreakfast(fromDbTime(data.breakfast_time))
        setLunch(fromDbTime(data.lunch_time))
        setDinner(fromDbTime(data.dinner_time))
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
    }
    const { error } = await supabase.from('profiles').upsert(payload)
    setSaving(false)
    if (error) setErr(error.message)
    else setMsg('保存しました')
  }

  if (loading) return <div className="p-6">読み込み中…</div>

  if (!userId) {
    return (
      <div className="p-6 space-y-3">
        <p>ログインが必要です。</p>
        <Link href="/sign-in" className="rounded bg-black text-white px-3 py-2 inline-block">
          サインインへ
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-5">
      <h1 className="text-2xl font-semibold">プロフィール設定</h1>
      <p className="text-sm text-gray-600">ログイン: {userEmail}</p>

      <form onSubmit={onSave} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">タイムゾーン</label>
          <input
            type="text"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full rounded border p-2"
            placeholder="Asia/Tokyo"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm mb-1">朝食時刻</label>
            <input
              type="time"
              value={breakfast}
              onChange={(e) => setBreakfast(e.target.value)}
              className="w-full rounded border p-2"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">昼食時刻</label>
            <input
              type="time"
              value={lunch}
              onChange={(e) => setLunch(e.target.value)}
              className="w-full rounded border p-2"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">夕食時刻</label>
            <input
              type="time"
              value={dinner}
              onChange={(e) => setDinner(e.target.value)}
              className="w-full rounded border p-2"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded bg-black text-white px-4 py-2 disabled:opacity-50"
        >
          {saving ? '保存中…' : '保存する'}
        </button>

        {msg && <p className="text-green-700 text-sm">{msg}</p>}
        {err && <p className="text-red-700 text-sm">{err}</p>}
      </form>
    </div>
  )
}
