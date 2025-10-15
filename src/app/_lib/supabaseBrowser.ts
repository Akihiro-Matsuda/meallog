'use client';

import { createBrowserClient } from '@supabase/ssr';

export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // 必要なら cookie 名などを明示。未指定でもOK
      cookieOptions: { path: '/', sameSite: 'lax' },
    }
  );
}
