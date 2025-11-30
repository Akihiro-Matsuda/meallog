import { NextResponse } from 'next/server'
import { requireAdmin, getSbAdmin } from '@/app/api/admin/_lib/requireAdmin'

export async function GET(req: Request) {
  const gate = await requireAdmin(req)
  if (gate instanceof Response) return gate

  const sbAdmin = getSbAdmin()
  const { data, error } = await sbAdmin
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, rows: data ?? [] })
}
