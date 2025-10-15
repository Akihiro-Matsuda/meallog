'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

export default function BedSurvey() {
  const [mood, setMood] = useState(4)
  const [stress, setStress] = useState(4)
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(null); setErr(null); setLoading(true)
    try {
      const { data: u } = await supabase.auth.getUser()
      const user = u.user
      if (!user) throw new Error('ログインが必要です')
      const payload = { mood, stress, note }
      const { error } = await supabase.from('surveys').insert({
        user_id: user.id, survey_type: 'bed',
        answered_at: new Date().toISOString(),
        payload
      })
      if (error) throw error
      setMsg('回答を保存しました')
    } catch (e: any) { setErr(e.message ?? String(e)) } finally { setLoading(false) }
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">就寝前アンケート</h1>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          気分（1–7）：<input type="range" min={1} max={7} value={mood} onChange={e=>setMood(+e.target.value)} />
          <span className="ml-2">{mood}</span>
        </label>
        <label className="block">
          ストレス（1–7）：<input type="range" min={1} max={7} value={stress} onChange={e=>setStress(+e.target.value)} />
          <span className="ml-2">{stress}</span>
        </label>
        <textarea className="w-full rounded border p-2" rows={3} placeholder="自由記述" value={note} onChange={e=>setNote(e.target.value)} />
        <button disabled={loading} className="rounded bg-black text-white px-3 py-2">{loading?'保存中…':'保存'}</button>
      </form>
      {msg && <p className="text-green-700 text-sm">{msg}</p>}
      {err && <p className="text-red-700 text-sm">{err}</p>}
      <Link href="/" className="underline text-blue-600">ホームへ</Link>
    </div>
  )
}