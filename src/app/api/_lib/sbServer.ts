import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Next 15 と @supabase/ssr の型ギャップを吸収する簡易アダプタ
type CookieAdapter = {
  get: (name: string) => string | undefined
  set: (name: string, value: string, options?: any) => void
  remove: (name: string, options?: any) => void
}

export async function getServerSupabase() {
  const store = await cookies()

  const adapter: CookieAdapter = {
    get: (name) => store.get(name)?.value,
    set: (name, value, options) => {
      // Next 15 準拠: set(name, value, options)
      store.set(name, value, options as any)
    },
    remove: (name, options) => {
      if (typeof (store as any).delete === 'function') {
        ;(store as any).delete(name, options as any)
      } else {
        store.set(name, '', { ...(options as any), maxAge: 0 })
      }
    },
  }

  return createServerClient(URL, ANON, { cookies: adapter })
}
