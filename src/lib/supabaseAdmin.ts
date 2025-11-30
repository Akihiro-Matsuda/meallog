import 'server-only'
import { createClient } from '@supabase/supabase-js'

export function getSbAdmin() {
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!URL || !SRK) {
    throw new Error('Supabase admin env missing')
  }
  return createClient(URL, SRK, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
