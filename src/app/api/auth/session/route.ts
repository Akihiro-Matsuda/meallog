import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/app/api/_lib/sbServer'

interface Payload {
  event?: string
  session?: any
}

export async function GET() {
  return NextResponse.json({
    ok: false,
    error: 'POST only',
    usage: {
      method: 'POST',
      body: { event: 'SIGNED_IN | TOKEN_REFRESHED | SIGNED_OUT | INITIAL_SESSION', session: '{access_token, refresh_token}' }
    }
  }, { status: 405 })
}

export async function POST(req: Request) {
  const supabase = await getServerSupabase()

  let payload: Payload = {}
  try {
    payload = await req.json()
  } catch {
    // ignore malformed body
  }

  const { event, session } = payload

  if (!event) {
    return NextResponse.json({ ok: false, error: 'event is required' }, { status: 400 })
  }

  const normalizeSession = (raw: any) => {
    if (!raw) return null
    const access_token = raw.access_token ?? raw?.session?.access_token
    const refresh_token = raw.refresh_token ?? raw?.session?.refresh_token
    if (!access_token || !refresh_token) return null
    return { access_token, refresh_token }
  }

  let result: { error: any } | null = null

  switch (event) {
    case 'SIGNED_IN':
    case 'TOKEN_REFRESHED':
    case 'USER_UPDATED':
    case 'INITIAL_SESSION': {
      const normalized = normalizeSession(session)
      if (normalized) {
        result = await supabase.auth.setSession(normalized)
      }
      break
    }
    case 'SIGNED_OUT':
      result = await supabase.auth.signOut()
      break
    default:
      break
  }

  const error = result?.error ? String(result.error?.message ?? result.error) : null

  return NextResponse.json({ ok: !error, event, error })
}
