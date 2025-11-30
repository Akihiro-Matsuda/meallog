import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/app/api/_lib/sbServer'
import { getSbAdmin } from '@/app/api/admin/_lib/requireAdmin'

export async function POST() {
  const sb = await getServerSupabase()
  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser()
  if (userErr || !user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const { error } = await sb
    .from('profiles')
    .update({ deleted_at: new Date().toISOString() })
    .eq('user_id', user.id)
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const sbAdmin = getSbAdmin()
  await sbAdmin.from('audit_log').insert({
    user_id: user.id,
    action: 'account.delete',
    detail: {},
  })

  return NextResponse.json({ ok: true })
}
