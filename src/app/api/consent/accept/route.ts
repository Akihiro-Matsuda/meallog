import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/app/api/_lib/sbServer'
import { sbAdmin } from '@/app/api/admin/_lib/requireAdmin'

const CONSENT_VERSION = 'v1'
const CONSENT_TEXT_HASH = 'sha256:xxxxxxxx'

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
    .from('consents')
    .upsert({
      user_id: user.id,
      version: CONSENT_VERSION,
      text_hash: CONSENT_TEXT_HASH,
      agreed_at: new Date().toISOString(),
    })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  await sbAdmin.from('audit_log').insert({
    user_id: user.id,
    action: 'consent.accepted',
    detail: { version: CONSENT_VERSION, text_hash: CONSENT_TEXT_HASH },
  })

  return NextResponse.json({ ok: true })
}
