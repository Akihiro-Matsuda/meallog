'use client';
import { useEffect } from 'react';
import { createSupabaseBrowser } from '@/app/_lib/supabaseBrowser';

export default function SessionSync() {
  useEffect(() => {
    const sb = createSupabaseBrowser();
    const sync = async (event: string, session: any) => {
      try {
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ event, session }),
          credentials: 'same-origin',
          cache: 'no-store',
        });
      } catch {
        // 失敗しても処理継続（次のイベントで再同期される）
      }
    };

    sb.auth.getSession().then(async ({ data: { session } }) => {
      if (session) await sync('INITIAL_SESSION', session);
    });

    const { data: { subscription } } = sb.auth.onAuthStateChange(async (event, session) => {
      await sync(event, session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);
  return null;
}
