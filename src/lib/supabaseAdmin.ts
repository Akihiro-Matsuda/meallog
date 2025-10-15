import 'server-only'
import { createClient } from '@supabase/supabase-js'

export const sbAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,         // 例: https://xxxxx.supabase.co
  process.env.SUPABASE_SERVICE_ROLE_KEY!,        // サーバー専用 (絶対にクライアントに使わない)
  { auth: { autoRefreshToken: false, persistSession: false } }
)
