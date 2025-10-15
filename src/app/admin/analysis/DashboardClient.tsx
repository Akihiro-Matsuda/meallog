'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

const TILE_ORDER = ['done', 'queued', 'processing', 'error', 'failed'] as const

type TileKey = (typeof TILE_ORDER)[number]

type TotalsRow = { status: string; count: number }
type JobRow = {
  id: number
  status: string
  created_at: string
  run_at: string | null
  payload: Record<string, unknown> | null
  error?: unknown
}

type StatsApiResponse = {
  ok: boolean
  totals?: TotalsRow[]
  errors?: JobRow[]
  queued?: JobRow[]
  range?: {
    startIso: string
    endIso: string
    startDate: string
    endDate: string
    timezone: string
  }
  error?: string
}

type ParticipantDailyRow = {
  user_id: string
  jst_date: string
  submitted_slots: number
  expected_slots: number
  missing_slots: number
}

type ParticipantAggregateRow = {
  user_id: string
  days: number
  submitted: number
  expected: number
  missing: number
  rate: number
}

type MissingRow = Record<string, unknown>

function readAccessToken(): string | null {
  const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k))
  if (!key) return null

  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return (
      parsed?.access_token ??
      parsed?.session?.access_token ??
      parsed?.currentSession?.access_token ??
      null
    )
  } catch {
    return null
  }
}

function extractImageId(payload: Record<string, unknown> | null): number | null {
  if (!payload) return null
  const source = payload as Record<string, unknown>
  const raw = source['image_id'] ?? source['imageId']

  if (typeof raw === 'number') return raw
  if (typeof raw === 'string') {
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function formatDateTime(iso: string | null) {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

function aggregateParticipantRows(rows: ParticipantDailyRow[]): ParticipantAggregateRow[] {
  const map = new Map<string, { days: number; submitted: number; expected: number; missing: number }>()
  for (const row of rows) {
    const entry = map.get(row.user_id) ?? { days: 0, submitted: 0, expected: 0, missing: 0 }
    entry.days += 1
    entry.submitted += row.submitted_slots
    entry.expected += row.expected_slots
    entry.missing += row.missing_slots
    map.set(row.user_id, entry)
  }
  return Array.from(map.entries()).map(([user_id, v]) => ({
    user_id,
    days: v.days,
    submitted: v.submitted,
    expected: v.expected,
    missing: v.missing,
    rate: v.expected > 0 ? v.submitted / v.expected : 0,
  }))
}

export default function DashboardClient() {
  const [token, setToken] = useState<string | null>(null)
  const [busy, setBusy] = useState<'idle' | 'stats' | 'export' | 'retry' | 'participants' | 'missing' | 'missingCsv'>('idle')
  const [range, setRange] = useState<{ start?: string; end?: string }>({})
  const [totals, setTotals] = useState<TotalsRow[]>([])
  const [errors, setErrors] = useState<JobRow[]>([])
  const [queued, setQueued] = useState<JobRow[]>([])
  const [rangeInfo, setRangeInfo] = useState<StatsApiResponse['range']>(undefined)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [manualImageId, setManualImageId] = useState('')
  const [participantDailyRows, setParticipantDailyRows] = useState<ParticipantDailyRow[]>([])
  const [participantAggregates, setParticipantAggregates] = useState<ParticipantAggregateRow[]>([])
  const [missingRows, setMissingRows] = useState<MissingRow[]>([])
  const [missingDate, setMissingDate] = useState('')

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (range.start) params.set('start', range.start)
    if (range.end) params.set('end', range.end)
    const q = params.toString()
    return q ? `?${q}` : ''
  }, [range])

  const missingHeaders = useMemo(() => {
    const keys = new Set<string>()
    for (const row of missingRows) {
      for (const key of Object.keys(row)) keys.add(key)
    }
    if (keys.size === 0) return ['user_id', 'email']
    return Array.from(keys)
  }, [missingRows])

  const refreshToken = useCallback(() => {
    setToken(readAccessToken())
  }, [])

  const fetchApi = useCallback(
    async <T extends { ok: boolean; error?: string }>(path: string, init: RequestInit = {}) => {
      if (!token) throw new Error('ブラウザにSupabaseのアクセストークンが見つかりません。/auth でログインしてください。')

      const headers = new Headers(init.headers as HeadersInit)
      headers.set('Authorization', `Bearer ${token}`)
      const res = await fetch(path, { cache: 'no-store', ...init, headers })
      const raw = await res.text()
      let body: T | null = null
      if (raw) {
        try {
          body = JSON.parse(raw) as T
        } catch {
          body = null
        }
      }
      if (!res.ok || !body?.ok) {
        const reason = body?.error || raw || `status ${res.status}`
        throw new Error(reason)
      }
      return body
    },
    [token]
  )

  useEffect(() => {
    refreshToken()
  }, [refreshToken])

  const fetchStats = useCallback(
    async (options: { showMessage?: boolean; requireToken?: boolean } = {}) => {
      const { showMessage = false, requireToken = false } = options
      if (!token) {
        if (requireToken) {
          setError('ブラウザにSupabaseのアクセストークンが見つかりません。/auth でログイン後、/auth/sync を開いてから再表示してください。')
        }
        return
      }

      setBusy('stats')
      if (showMessage) setMessage(null)
      setError(null)
      try {
        const body = await fetchApi<StatsApiResponse>(`/api/admin/analysis/stats${queryString}`)
        setTotals(body.totals ?? [])
        setErrors(body.errors ?? [])
        setQueued(body.queued ?? [])
        setRangeInfo(body.range)
        if (showMessage) setMessage('集計を更新しました')
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setBusy('idle')
      }
    },
    [fetchApi, queryString, token]
  )

  useEffect(() => {
    void fetchStats({ showMessage: false, requireToken: false })
  }, [fetchStats])

  const exportCsv = async () => {
    if (!token) {
      setError('アクセストークンが取得できません。/auth でログインしてください。')
      return
    }
    setBusy('export')
    setMessage(null)
    setError(null)
    try {
      const res = await fetch(`/api/admin/analysis/export${queryString}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        throw new Error(`status ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'meal-analysis.csv'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      setMessage('CSVのダウンロードを開始しました')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy('idle')
    }
  }

  const enqueueRetry = async (imageId: number) => {
    if (!token) {
      setError('アクセストークンが取得できません。/auth でログインしてください。')
      return
    }
    setBusy('retry')
    setMessage(null)
    setError(null)
    try {
      await fetchApi<{ ok: boolean; error?: string }>(
        '/api/admin/analysis/retry',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ image_id: imageId }),
        }
      )
      setMessage(`image_id ${imageId} を再解析キューに投入しました`)
      await fetchStats({ showMessage: false, requireToken: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy('idle')
    }
  }

  const onManualRetry = async () => {
    const parsed = Number(manualImageId.trim())
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('image_id を正しく入力してください。')
      return
    }
    await enqueueRetry(parsed)
    setManualImageId('')
  }

  const getCount = (status: TileKey) =>
    totals.find((row) => row.status === status)?.count ?? 0

  const loadParticipantStats = async () => {
    if (!range.start || !range.end) {
      setError('被験者の収集率を取得するには開始日と終了日を指定してください。')
      return
    }
    setBusy('participants')
    setMessage(null)
    setError(null)
    try {
      const params = new URLSearchParams({ start: range.start, end: range.end })
      const body = await fetchApi<{ ok: boolean; rows: ParticipantDailyRow[] }>(
        `/api/admin/participants/stats?${params.toString()}`
      )
      const rows = body.rows ?? []
      setParticipantDailyRows(rows)
      setParticipantAggregates(aggregateParticipantRows(rows))
      setMessage(`被験者の収集率を更新しました（${rows.length} 行）`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy('idle')
    }
  }

  const loadMissingParticipants = async () => {
    setBusy('missing')
    setMessage(null)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (missingDate) params.set('date', missingDate)
      const query = params.toString()
      const body = await fetchApi<{ ok: boolean; rows: MissingRow[] }>(
        `/api/admin/participants/missing${query ? `?${query}` : ''}`
      )
      const rows = body.rows ?? []
      setMissingRows(rows)
      setMessage(`未提出者を取得しました（${rows.length} 人）`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy('idle')
    }
  }

  const downloadMissingCsv = async () => {
    if (!token) {
      setError('アクセストークンが取得できません。/auth でログインしてください。')
      return
    }
    setBusy('missingCsv')
    setMessage(null)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (missingDate) params.set('date', missingDate)
      params.set('format', 'csv')
      const path = `/api/admin/participants/missing?${params.toString()}`
      const res = await fetch(path, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const raw = await res.text()
        const reason = raw || `status ${res.status}`
        throw new Error(reason)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'missing_participants.csv'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      setMessage('未提出者のCSVをダウンロードしました')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy('idle')
    }
  }

  return (
    <div className="space-y-6">
      {!token && (
        <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
          ブラウザに Supabase のアクセストークンがありません。/auth でサインイン → /auth/sync を開いた後、
          「トークン再取得」を押してください。
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-sm text-gray-600">開始日 (JST)</label>
          <input
            type="date"
            value={range.start ?? ''}
            onChange={(e) => setRange((r) => ({ ...r, start: e.target.value || undefined }))}
            className="rounded border px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600">終了日 (JST)</label>
          <input
            type="date"
            value={range.end ?? ''}
            onChange={(e) => setRange((r) => ({ ...r, end: e.target.value || undefined }))}
            className="rounded border px-3 py-2"
          />
        </div>
        <button
          type="button"
          onClick={() => setRange({})}
          className="rounded border px-3 py-2"
        >
          今日に戻す
        </button>
        <button
          type="button"
          onClick={() => fetchStats({ showMessage: true, requireToken: true })}
          disabled={busy !== 'idle'}
          className="rounded border bg-gray-100 px-3 py-2 disabled:opacity-50"
        >
          {busy === 'stats' ? '再読込中…' : '再読込'}
        </button>
        <button
          type="button"
          onClick={exportCsv}
          disabled={busy !== 'idle'}
          className="rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
        >
          {busy === 'export' ? '生成中…' : 'CSVをダウンロード'}
        </button>
        <button
          type="button"
          onClick={refreshToken}
          className="rounded border px-3 py-2"
        >
          トークン再取得
        </button>
      </div>

      {rangeInfo && (
        <div className="text-sm text-gray-500">
          解析対象: {rangeInfo.startDate}〜{rangeInfo.endDate} ({rangeInfo.timezone})
        </div>
      )}

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {TILE_ORDER.map((status) => (
          <div key={status} className="rounded border bg-white p-4 shadow-sm">
            <div className="text-xs uppercase text-gray-500">{status}</div>
            <div className="text-2xl font-semibold">{getCount(status)}</div>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">直近の失敗（最大20件）</h2>
          <div className="text-xs text-gray-500">error / failed</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[760px] text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="border px-3 py-2">ID</th>
                <th className="border px-3 py-2">image_id</th>
                <th className="border px-3 py-2">created_at</th>
                <th className="border px-3 py-2">status</th>
                <th className="border px-3 py-2">action</th>
              </tr>
            </thead>
            <tbody>
              {errors.map((row) => {
                const imageId = extractImageId(row.payload)
                return (
                  <tr key={row.id}>
                    <td className="border px-3 py-2">{row.id}</td>
                    <td className="border px-3 py-2">{imageId ?? '-'}</td>
                    <td className="border px-3 py-2">{formatDateTime(row.created_at)}</td>
                    <td className="border px-3 py-2">{row.status}</td>
                    <td className="border px-3 py-2">
                      <button
                        type="button"
                        disabled={busy !== 'idle' || !imageId}
                        onClick={() => imageId && enqueueRetry(imageId)}
                        className="rounded bg-emerald-600 px-3 py-1 text-white disabled:opacity-50"
                      >
                        {busy === 'retry' ? '投入中…' : '再実行'}
                      </button>
                    </td>
                  </tr>
                )
              })}
              {errors.length === 0 && (
                <tr>
                  <td colSpan={5} className="border px-3 py-6 text-center text-gray-400">
                    失敗はありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">保留中のジョブ（最大20件）</h2>
          <div className="text-xs text-gray-500">queued / processing</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[760px] text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="border px-3 py-2">ID</th>
                <th className="border px-3 py-2">image_id</th>
                <th className="border px-3 py-2">status</th>
                <th className="border px-3 py-2">created_at</th>
                <th className="border px-3 py-2">run_at</th>
              </tr>
            </thead>
            <tbody>
              {queued.map((row) => {
                const imageId = extractImageId(row.payload)
                return (
                  <tr key={row.id}>
                    <td className="border px-3 py-2">{row.id}</td>
                    <td className="border px-3 py-2">{imageId ?? '-'}</td>
                    <td className="border px-3 py-2">{row.status}</td>
                    <td className="border px-3 py-2">{formatDateTime(row.created_at)}</td>
                    <td className="border px-3 py-2">{formatDateTime(row.run_at)}</td>
                  </tr>
                )
              })}
              {queued.length === 0 && (
                <tr>
                  <td colSpan={5} className="border px-3 py-6 text-center text-gray-400">
                    保留中のジョブはありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">被験者の収集率</h2>
            <p className="text-xs text-gray-500">開始日と終了日を設定してから集計してください。</p>
          </div>
          <button
            type="button"
            onClick={loadParticipantStats}
            disabled={busy !== 'idle'}
            className="rounded border px-3 py-2 disabled:opacity-50"
          >
            {busy === 'participants' ? '集計中…' : '期間の収集率を集計'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[640px] text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="border px-3 py-2">user_id</th>
                <th className="border px-3 py-2">days</th>
                <th className="border px-3 py-2">submitted</th>
                <th className="border px-3 py-2">expected</th>
                <th className="border px-3 py-2">missing</th>
                <th className="border px-3 py-2">rate</th>
              </tr>
            </thead>
            <tbody>
              {participantAggregates.map((row) => (
                <tr key={row.user_id}>
                  <td className="border px-3 py-2 font-mono text-xs">{row.user_id}</td>
                  <td className="border px-3 py-2">{row.days}</td>
                  <td className="border px-3 py-2">{row.submitted}</td>
                  <td className="border px-3 py-2">{row.expected}</td>
                  <td className="border px-3 py-2">{row.missing}</td>
                  <td className="border px-3 py-2">{(row.rate * 100).toFixed(1)}%</td>
                </tr>
              ))}
              {participantAggregates.length === 0 && (
                <tr>
                  <td colSpan={6} className="border px-3 py-6 text-center text-gray-400">
                    集計結果がありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {participantDailyRows.length > 0 && (
          <details className="rounded border bg-gray-50 p-3">
            <summary className="cursor-pointer text-sm font-medium">日別の明細を表示する</summary>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-[720px] text-sm">
                <thead>
                  <tr className="bg-white text-left">
                    <th className="border px-3 py-2">user_id</th>
                    <th className="border px-3 py-2">jst_date</th>
                    <th className="border px-3 py-2">submitted_slots</th>
                    <th className="border px-3 py-2">expected_slots</th>
                    <th className="border px-3 py-2">missing_slots</th>
                  </tr>
                </thead>
                <tbody>
                  {participantDailyRows.map((row, idx) => (
                    <tr key={`${row.user_id}-${row.jst_date}-${idx}`}>
                      <td className="border px-3 py-2 font-mono text-xs">{row.user_id}</td>
                      <td className="border px-3 py-2">{row.jst_date}</td>
                      <td className="border px-3 py-2">{row.submitted_slots}</td>
                      <td className="border px-3 py-2">{row.expected_slots}</td>
                      <td className="border px-3 py-2">{row.missing_slots}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">未提出者リスト</h2>
            <p className="text-xs text-gray-500">日付未指定の場合は今日の未提出者を取得します。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={missingDate}
              onChange={(e) => setMissingDate(e.target.value)}
              className="rounded border px-3 py-2"
            />
            <button
              type="button"
              onClick={loadMissingParticipants}
              disabled={busy !== 'idle'}
              className="rounded border px-3 py-2 disabled:opacity-50"
            >
              {busy === 'missing' ? '取得中…' : '未提出者を取得'}
            </button>
            <button
              type="button"
              onClick={downloadMissingCsv}
              disabled={busy !== 'idle'}
              className="rounded border px-3 py-2 disabled:opacity-50"
            >
              {busy === 'missingCsv' ? '生成中…' : 'CSVをダウンロード'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[720px] text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                {missingHeaders.map((key) => (
                  <th key={key} className="border px-3 py-2">{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {missingRows.map((row, idx) => (
                <tr key={`missing-${idx}`}>
                  {missingHeaders.map((key) => (
                    <td key={key} className="border px-3 py-2">{String(row[key] ?? '')}</td>
                  ))}
                </tr>
              ))}
              {missingRows.length === 0 && (
                <tr>
                  <td colSpan={missingHeaders.length} className="border px-3 py-6 text-center text-gray-400">
                    未提出者はありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded border p-4 space-y-3">
        <h2 className="text-lg font-semibold">画像IDを直接指定して再解析</h2>
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={manualImageId}
            onChange={(e) => setManualImageId(e.target.value)}
            placeholder="image_id"
            inputMode="numeric"
            className="w-48 rounded border px-3 py-2"
          />
          <button
            type="button"
            onClick={onManualRetry}
            disabled={busy !== 'idle'}
            className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-50"
          >
            {busy === 'retry' ? '投入中…' : 'キューに追加'}
          </button>
        </div>
      </section>
    </div>
  )
}
