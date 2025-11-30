import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getSbAdmin } from '@/app/api/admin/_lib/requireAdmin'

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (gate instanceof Response) return gate

  const url = req.nextUrl
  const date = url.searchParams.get('date') ?? undefined
  const format = url.searchParams.get('format')

  const sbAdmin = getSbAdmin()
  const { data, error } = await sbAdmin.rpc(
    'admin_missing_today',
    date ? { tgt_date: date } : {}
  )

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as Record<string, unknown>[]

  if (format === 'csv') {
    if (!rows.length) {
      return new NextResponse('user_id,email,timezone\n', {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="missing_today.csv"',
        },
      })
    }

    const header = Object.keys(rows[0])
    const esc = (v: unknown) => {
      const s = String(v ?? '')
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const csv = [header.join(','), ...rows.map((r) => header.map((k) => esc(r[k])).join(','))].join('\n')
    return new NextResponse('\uFEFF' + csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="missing_today.csv"',
      },
    })
  }

  return NextResponse.json({ ok: true, rows })
}
