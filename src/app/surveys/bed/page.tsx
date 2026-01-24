'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { HomeInlineButton } from '@/components/HomeInlineButton'

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

  const clampValue = (v: number) => Math.min(7, Math.max(1, v || 1))
  const toSingleDigit = (value: string) =>
    value
      .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 65248))
      .replace(/\D/g, '')
      .slice(-1)

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="mx-auto max-w-xl px-5 py-6 space-y-5">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-amber-300 font-semibold">daily</p>
              <h1 className="text-2xl font-bold text-white">就寝アンケート</h1>
            </div>
            <HomeInlineButton />
          </div>
          <p className="text-sm text-slate-200">就寝前の状態を簡単に入力してください。今日もお疲れ様でした。</p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-700 bg-slate-800/80 p-4 shadow-lg">
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">気分（1–7段階）</span>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-3 items-center">
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={mood}
                  onChange={(e) => {
                    const next = toSingleDigit(e.target.value)
                    if (!next) return
                    setMood(clampValue(Number(next)))
                  }}
                  className="rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2 text-center text-lg font-semibold text-white shadow-sm"
                />
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-300">
                    <span>1: とても不調</span>
                    <span>7: とても快調</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={7}
                    value={mood}
                    onChange={e=>setMood(+e.target.value)}
                    className="w-full accent-amber-400"
                  />
                  <div className="flex justify-between text-[11px] text-slate-300 px-1">
                    {[1,2,3,4,5,6,7].map(n => (
                      <span key={n} className="flex flex-col items-center gap-0.5">
                        <span className="w-px h-3 bg-slate-500"></span>
                        <span>{n}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">ストレス（1–7段階）</span>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-3 items-center">
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={stress}
                  onChange={(e) => {
                    const next = toSingleDigit(e.target.value)
                    if (!next) return
                    setStress(clampValue(Number(next)))
                  }}
                  className="rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2 text-center text-lg font-semibold text-white shadow-sm"
                />
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-300">
                    <span>1: とても低い</span>
                    <span>7: とても高い</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={7}
                    value={stress}
                    onChange={e=>setStress(+e.target.value)}
                    className="w-full accent-amber-400"
                  />
                  <div className="flex justify-between text-[11px] text-slate-300 px-1">
                    {[1,2,3,4,5,6,7].map(n => (
                      <span key={n} className="flex flex-col items-center gap-0.5">
                        <span className="w-px h-3 bg-slate-500"></span>
                        <span>{n}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <label className="block text-sm font-semibold text-white">
              自由記述（任意）
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900/60 text-white px-3 py-3 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-200/30 placeholder:text-slate-400"
                rows={3}
                placeholder="気分の理由やひとこと"
                value={note}
                onChange={e=>setNote(e.target.value)}
              />
            </label>
          </div>

          <button
            disabled={loading}
            className="w-full rounded-lg bg-amber-500 text-slate-900 px-4 py-3 font-semibold hover:bg-amber-400 disabled:opacity-60 transition"
          >
            {loading?'保存中…':'保存する'}
          </button>
          {msg && <p className="text-emerald-300 text-sm">{msg}</p>}
          {err && <p className="text-red-300 text-sm">{err}</p>}
        </form>
      </div>
    </main>
  )
}
