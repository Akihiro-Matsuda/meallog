import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/app/api/_lib/sbServer'
import { getSbAdmin } from '@/app/api/admin/_lib/requireAdmin'

export async function GET() {
  const sb = await getServerSupabase()
  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser()
  if (userErr || !user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const chunks: string[] = []

  async function dump(table: string, select = '*') {
    const { data, error } = await sb.from(table).select(select).eq('user_id', user.id)
    if (error) throw new Error(`${table}: ${error.message}`)
    for (const row of data ?? []) {
      chunks.push(`${JSON.stringify({ table, row })}\n`)
    }
  }

  try {
    await dump('meals')
    await dump('meal_images')
    await dump('meal_analysis')

    const sbAdmin = getSbAdmin()
    await sbAdmin.from('audit_log').insert({
      user_id: user.id,
      action: 'export.requested',
      detail: {},
    })

    return new NextResponse(chunks.join(''), {
      status: 200,
      headers: {
        'content-type': 'application/x-ndjson; charset=utf-8',
        'content-disposition': `attachment; filename="meallog-export-${user.id}.ndjson"`,
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
