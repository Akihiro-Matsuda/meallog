'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { HomeInlineButton } from '@/components/HomeInlineButton'

export default function WakeSurvey() {
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
        user_id: user.id, survey_type: 'wake',
        answered_at: new Date().toISOString(),
        payload
      })
      if (error) throw error
      setMsg('回答を保存しました')
    } catch (e: any) { setErr(e.message ?? String(e)) } finally { setLoading(false) }
  }

  const clampValue = (v: number) => Math.min(7, Math.max(1, v || 1))

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-slate-50">
      <div className="mx-auto max-w-xl px-5 py-6 space-y-5">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-amber-700 font-semibold">daily</p>
              <h1 className="text-2xl font-bold text-slate-900">起床アンケート</h1>
            </div>
            <HomeInlineButton />
          </div>
          <p className="text-sm text-slate-700">起床直後の状態を簡単に教えてください。今日も元気にいきましょう。</p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800">気分（1–7段階）</span>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-3 items-center">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={7}
                  value={mood}
                  onChange={(e) => setMood(clampValue(Number(e.target.value)))}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-lg font-semibold text-slate-900 shadow-sm"
                />
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>1: とても不調</span>
                    <span>7: とても快調</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={7}
                    value={mood}
                    onChange={e=>setMood(+e.target.value)}
                    className="w-full accent-amber-500"
                  />
                  <div className="flex justify-between text-[11px] text-slate-500 px-1">
                    {[1,2,3,4,5,6,7].map(n => (
                      <span key={n} className="flex flex-col items-center gap-0.5">
                        <span className="w-px h-3 bg-slate-300"></span>
                        <span>{n}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800">ストレス（1–7段階）</span>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-3 items-center">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={7}
                  value={stress}
                  onChange={(e) => setStress(clampValue(Number(e.target.value)))}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-lg font-semibold text-slate-900 shadow-sm"
                />
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>1: とても低い</span>
                    <span>7: とても高い</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={7}
                    value={stress}
                    onChange={e=>setStress(+e.target.value)}
                    className="w-full accent-amber-500"
                  />
                  <div className="flex justify-between text-[11px] text-slate-500 px-1">
                    {[1,2,3,4,5,6,7].map(n => (
                      <span key={n} className="flex flex-col items-center gap-0.5">
                        <span className="w-px h-3 bg-slate-300"></span>
                        <span>{n}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <label className="block text-sm font-semibold text-slate-800">
              自由記述（任意）
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                rows={3}
                placeholder="気分の理由やひとこと"
                value={note}
                onChange={e=>setNote(e.target.value)}
              />
            </label>
          </div>

          <button
            disabled={loading}
            className="w-full rounded-lg bg-amber-500 text-white px-4 py-3 font-semibold hover:bg-amber-600 disabled:opacity-60 transition"
          >
            {loading?'保存中…':'保存する'}
          </button>
          {msg && <p className="text-green-700 text-sm">{msg}</p>}
          {err && <p className="text-red-700 text-sm">{err}</p>}
        </form>
      </div>
    </main>
  )
}
