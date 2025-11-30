import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getSbAdmin } from '@/app/api/admin/_lib/requireAdmin'

const ERROR_STATUSES = ['error', 'failed']
const PENDING_STATUSES = ['queued', 'processing']
const RECENT_LIMIT = 20

function formatJstDate(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function startOfJstDay(date: Date) {
  const iso = `${formatJstDate(date)}T00:00:00+09:00`
  return new Date(iso)
}

function buildJstRange(start?: string | null, end?: string | null) {
  const today = startOfJstDay(new Date())

  const startDate = start ? new Date(`${start}T00:00:00+09:00`) : today
  const endBase = end
    ? new Date(`${end}T00:00:00+09:00`)
    : start
    ? new Date(`${start}T00:00:00+09:00`)
    : today

  const normalizedEnd = endBase < startDate ? startDate : endBase
  const endExclusive = new Date(normalizedEnd.getTime() + 24 * 60 * 60 * 1000)

  return {
    startIso: startDate.toISOString(),
    endIso: endExclusive.toISOString(),
    startDate: formatJstDate(startDate),
    endDate: formatJstDate(normalizedEnd),
  }
}

type RawRow = Record<string, unknown>

function normalizeTotals(raw: unknown[] | null | undefined) {
  return (raw ?? []).map((row) => ({
    status: String((row as RawRow).status ?? ''),
    count: Number((row as RawRow).count ?? 0),
  }))
}

function normalizeJobs(raw: unknown[] | null | undefined, deriveError = false) {
  return (raw ?? []).map((row) => {
    const r = row as RawRow
    const payload = (r.payload ?? null) as RawRow | null

    return {
      id: Number(r.id ?? 0),
      status: String(r.status ?? ''),
      created_at: String(r.created_at ?? ''),
      run_at: r.run_at ? String(r.run_at) : null,
      payload,
      error: deriveError ? (payload?.error ?? null) : r.error ?? null,
    }
  })
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth

  const { searchParams } = req.nextUrl
  const { startIso, endIso, startDate, endDate } = buildJstRange(
    searchParams.get('start'),
    searchParams.get('end')
  )

  const sbAdmin = getSbAdmin()

  const [totalsRes, errorRowsRes, pendingRowsRes] = await Promise.all([
    sbAdmin.rpc('count_job_status_by_range', {
      p_job_type: 'analyze_meal',
      p_start: startIso,
      p_end: endIso,
    }),
    sbAdmin
      .from('jobs')
      .select('id, status, created_at, run_at, payload')
      .eq('job_type', 'analyze_meal')
      .in('status', ERROR_STATUSES)
      .gte('created_at', startIso)
      .lt('created_at', endIso)
      .order('created_at', { ascending: false })
      .limit(RECENT_LIMIT),
    sbAdmin
      .from('jobs')
      .select('id, status, created_at, run_at, payload')
      .eq('job_type', 'analyze_meal')
      .in('status', PENDING_STATUSES)
      .order('created_at', { ascending: false })
      .limit(RECENT_LIMIT),
  ])

  const firstError = totalsRes.error || errorRowsRes.error || pendingRowsRes.error
  if (firstError) {
    return NextResponse.json(
      { ok: false, error: firstError.message ?? String(firstError) },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    range: {
      startIso,
      endIso,
      startDate,
      endDate,
      timezone: `UTC+09:00`,
    },
    totals: normalizeTotals(totalsRes.data),
    errors: normalizeJobs(errorRowsRes.data, true),
    queued: normalizeJobs(pendingRowsRes.data),
  })
}
