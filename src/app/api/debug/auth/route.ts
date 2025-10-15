import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerSupabase } from '@/app/api/_lib/sbServer'

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!

export async function GET() {
  const store = await cookies()
  const sb = await getServerSupabase()

  const { data: { user }, error } = await sb.auth.getUser()

  const ref = URL.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1]
  const expected = ref ? `sb-${ref}-auth-token` : null
  const names = store.getAll().map(c => c.name)
  const hasExpected = expected ? names.includes(expected) : null

  return NextResponse.json({
    env: { url: URL, projectRef: ref },
    cookies: { expected, hasExpected, names },
    user: user ? { id: user.id, email: user.email } : null,
    error: error?.message ?? null,
  })
}
