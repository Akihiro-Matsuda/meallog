'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { formatInTimeZone, toZonedTime } from 'date-fns-tz'
import { supabase } from '@/lib/supabaseClient'
import { HomeInlineButton } from '@/components/HomeInlineButton'

type SurveyType = 'wake' | 'bed'

type SurveyRow = {
  id: number
  survey_type: SurveyType
  answered_at: string
  payload: { mood?: number; stress?: number; note?: string } | null
}

type ProfileRow = {
  timezone?: string | null
  wakeup_time?: string | null
  bed_time?: string | null
}

type DailyStatus = 'done' | 'waiting' | 'missing' | 'not_set'
const BED_SURVEY_DAY_CUTOFF_HOUR = 4

function parseHourMin(value: string | null | undefined): { h: number; m: number } | null {
  if (!value) return null
  const [hh, mm] = value.split(':')
  if (hh == null || mm == null) return null
  const h = Number.parseInt(hh, 10)
  const m = Number.parseInt(mm, 10)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return { h, m }
}

function getLastDaysKeys(tz: string, days: number): string[] {
  const nowLocal = toZonedTime(new Date(), tz)
  const keys: string[] = []
  for (let i = 0; i < days; i += 1) {
    const d = new Date(nowLocal)
    d.setDate(nowLocal.getDate() - i)
    keys.push(formatInTimeZone(d, tz, 'yyyy-MM-dd'))
  }
  return keys
}

function surveyLogicalDateKey(answeredAt: string, surveyType: SurveyType, tz: string): string {
  const at = new Date(answeredAt)
  if (surveyType !== 'bed') {
    return formatInTimeZone(at, tz, 'yyyy-MM-dd')
  }

  const localHour = Number.parseInt(formatInTimeZone(at, tz, 'H'), 10)
  if (Number.isNaN(localHour) || localHour >= BED_SURVEY_DAY_CUTOFF_HOUR) {
    return formatInTimeZone(at, tz, 'yyyy-MM-dd')
  }

  const adjusted = toZonedTime(at, tz)
  adjusted.setDate(adjusted.getDate() - 1)
  return formatInTimeZone(adjusted, tz, 'yyyy-MM-dd')
}

function badgeClass(status: DailyStatus): string {
  if (status === 'done') return 'bg-emerald-100 text-emerald-800'
  if (status === 'missing') return 'bg-red-100 text-red-800'
  if (status === 'waiting') return 'bg-amber-100 text-amber-800'
  return 'bg-slate-100 text-slate-700'
}

function statusLabel(status: DailyStatus): string {
  if (status === 'done') return '回答済み'
  if (status === 'missing') return '未回答'
  if (status === 'waiting') return '回答待ち'
  return '判定対象外（時刻未設定）'
}

export default function SurveyStatusPage() {
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [tz, setTz] = useState('Asia/Tokyo')
  const [wakeupTime, setWakeupTime] = useState<string | null>(null)
  const [bedTime, setBedTime] = useState<string | null>(null)
  const [rows, setRows] = useState<SurveyRow[]>([])

  useEffect(() => {
    ;(async () => {
      setErr(null)
      setLoading(true)
      try {
        const { data: u, error: userErr } = await supabase.auth.getUser()
        if (userErr) throw userErr
        const user = u.user
        if (!user) throw new Error('ログインが必要です')

        const { data: p, error: profErr } = await supabase
          .from('profiles')
          .select('timezone, wakeup_time, bed_time')
          .eq('user_id', user.id)
          .maybeSingle()
        if (profErr) throw profErr

        const profile = (p ?? {}) as ProfileRow
        const timezone = profile.timezone || 'Asia/Tokyo'
        setTz(timezone)
        setWakeupTime(profile.wakeup_time ?? null)
        setBedTime(profile.bed_time ?? null)

        const { data, error } = await supabase
          .from('surveys')
          .select('id, survey_type, answered_at, payload')
          .eq('user_id', user.id)
          .in('survey_type', ['wake', 'bed'])
          .order('answered_at', { ascending: false })
          .limit(10)
        if (error) throw error

        setRows((data ?? []) as SurveyRow[])
      } catch (e: any) {
        setErr(e?.message ?? String(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const byDayType = useMemo(() => {
    const map = new Map<string, SurveyRow>()
    for (const r of rows) {
      const key = `${surveyLogicalDateKey(r.answered_at, r.survey_type, tz)}__${r.survey_type}`
      if (!map.has(key)) map.set(key, r)
    }
    return map
  }, [rows, tz])

  const todayKey = useMemo(() => formatInTimeZone(new Date(), tz, 'yyyy-MM-dd'), [tz])

  const dailyStatus = useMemo(() => {
    const nowLocal = toZonedTime(new Date(), tz)

    const build = (type: SurveyType, timeStr: string | null): DailyStatus => {
      if (!timeStr) return 'not_set'
      const answered = byDayType.has(`${todayKey}__${type}`)
      if (answered) return 'done'

      const hm = parseHourMin(timeStr)
      if (!hm) return 'not_set'

      const due = new Date(nowLocal)
      due.setHours(hm.h, hm.m, 0, 0)
      return nowLocal < due ? 'waiting' : 'missing'
    }

    return {
      wake: build('wake', wakeupTime),
      bed: build('bed', bedTime),
    } as const
  }, [byDayType, todayKey, tz, wakeupTime, bedTime])

  const recentMissing = useMemo(() => {
    const days = getLastDaysKeys(tz, 7)
    const nowLocal = toZonedTime(new Date(), tz)

    const list: Array<{ date: string; type: SurveyType }> = []
    for (const date of days) {
      for (const type of ['wake', 'bed'] as const) {
        const t = type === 'wake' ? wakeupTime : bedTime
        if (!t) continue
        if (byDayType.has(`${date}__${type}`)) continue

        if (date === todayKey) {
          const hm = parseHourMin(t)
          if (!hm) continue
          const due = new Date(nowLocal)
          due.setHours(hm.h, hm.m, 0, 0)
          if (nowLocal < due) continue
        }
        list.push({ date, type })
      }
    }
    return list
  }, [byDayType, tz, todayKey, wakeupTime, bedTime])

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-slate-50">
      <div className="mx-auto max-w-xl px-5 py-6 space-y-5">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-amber-700 font-semibold">daily</p>
              <h1 className="text-2xl font-bold text-slate-900">アンケート状況</h1>
            </div>
            <HomeInlineButton />
          </div>
          <p className="text-sm text-slate-700">起床・就寝アンケートの回答状況と、過去の回答を確認できます。</p>
        </div>

        {err && <p className="text-sm text-red-700">{err}</p>}

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">今日の回答状況</h2>
            <span className="text-xs text-slate-500">{todayKey}</span>
          </div>
          {loading ? (
            <p className="text-sm text-slate-600">読み込み中…</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">起床アンケート</p>
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${badgeClass(dailyStatus.wake)}`}>{statusLabel(dailyStatus.wake)}</span>
                </div>
                <p className="text-xs text-slate-600 mt-2">設定時刻: {wakeupTime ? wakeupTime.slice(0, 5) : '未設定'}</p>
                <Link href="/surveys/wake" className="mt-3 inline-block text-xs text-amber-700 underline decoration-amber-500 decoration-2 underline-offset-4">回答ページへ</Link>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">就寝アンケート</p>
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${badgeClass(dailyStatus.bed)}`}>{statusLabel(dailyStatus.bed)}</span>
                </div>
                <p className="text-xs text-slate-600 mt-2">設定時刻: {bedTime ? bedTime.slice(0, 5) : '未設定'}</p>
                <Link href="/surveys/bed" className="mt-3 inline-block text-xs text-amber-700 underline decoration-amber-500 decoration-2 underline-offset-4">回答ページへ</Link>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-slate-800">直近7日の未回答</h2>
          {loading ? (
            <p className="text-sm text-slate-600">読み込み中…</p>
          ) : recentMissing.length === 0 ? (
            <p className="text-sm text-slate-600">未回答はありません（または時刻未設定のため判定対象外です）。</p>
          ) : (
            <ul className="space-y-2">
              {recentMissing.map((m) => (
                <li key={`${m.date}_${m.type}`} className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800 flex items-center justify-between">
                  <span>{m.date} / {m.type === 'wake' ? '起床アンケート' : '就寝アンケート'}</span>
                  <Link href={m.type === 'wake' ? '/surveys/wake' : '/surveys/bed'} className="text-xs underline">回答する</Link>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-slate-500">注: 時刻未設定のアンケートは未回答判定の対象外です。</p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-slate-800">過去の回答一覧（最新10件）</h2>
          {loading ? (
            <p className="text-sm text-slate-600">読み込み中…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-600">まだ回答がありません。</p>
          ) : (
            <ul className="space-y-2">
              {rows.map((r) => (
                <li key={r.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800 font-semibold">
                      {r.survey_type === 'wake' ? '起床' : '就寝'}
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatInTimeZone(new Date(r.answered_at), tz, 'yyyy/MM/dd HH:mm')}
                    </span>
                  </div>
                  <p className="text-sm text-slate-800 mt-2">
                    気分: {r.payload?.mood ?? '-'} / ストレス: {r.payload?.stress ?? '-'}
                  </p>
                  {r.payload?.note ? (
                    <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{r.payload.note}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
