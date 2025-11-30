import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getSbAdmin } from '@/app/api/admin/_lib/requireAdmin'

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (gate instanceof Response) return gate

  const url = req.nextUrl
  const start = url.searchParams.get('start')
  const end = url.searchParams.get('end')

  if (!start || !end) {
    return NextResponse.json({ ok: false, error: 'start/end are required' }, { status: 400 })
  }

  const sbAdmin = getSbAdmin()
  const { data, error } = await sbAdmin.rpc('admin_participant_stats', {
    start_date: start,
    end_date: end,
  })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, rows: data ?? [] })
}
