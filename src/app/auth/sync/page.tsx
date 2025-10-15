'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/app/_lib/supabaseBrowser';

export default function SyncSession() {
  const router = useRouter();
  useEffect(() => {
    const run = async () => {
      const sb = createSupabaseBrowser();
      const { data: { session } } = await sb.auth.getSession();
      const sync = async (event: string, payload: any) => {
        try {
          await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ event, session: payload }),
            credentials: 'same-origin',
            cache: 'no-store',
          });
        } catch {
          // ベストエフォート
        }
      };
      if (session) {
        await sync('SIGNED_IN', session);
        router.replace('/admin/analysis'); // 直行
      } else {
        await sync('SIGNED_OUT', null);
        router.replace('/auth'); // 未ログイン
      }
    };
    run();
  }, [router]);

  return <p>Syncing session…</p>;
}
