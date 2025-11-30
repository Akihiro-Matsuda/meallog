import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getServerSupabase } from '@/app/api/_lib/sbServer'
import { headers } from 'next/headers'

export function getSbAdmin() {
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!URL || !SRK) {
    throw new Error('Supabase admin env missing')
  }
  return createServiceClient(URL, SRK, { auth: { persistSession: false } })
}

export async function requireAdmin(req?: Request) {
  const sb = await getServerSupabase();

  // 1) まずは Cookie ベース（今は失敗してる想定）
  const { data: cookieData, error: cookieErr } = await sb.auth.getUser();
  let user = cookieData?.user;

  // 2) だめなら Bearer トークンを拾って再トライ
  if (!user) {
    let token: string | undefined;

    // Route Handler から渡された Request を優先
    if (req) {
      const h = req.headers.get('authorization') || '';
      token = /^Bearer\s+(.+)/i.exec(h)?.[1];
    }

    // それでも無ければサーバのヘッダから
    if (!token) {
      const h = await headers();
      const raw = h.get('authorization') || '';
      token = /^Bearer\s+(.+)/i.exec(raw)?.[1];
    }

    if (token) {
      const byTok = await sb.auth.getUser(token);
      user = byTok.data?.user ?? null;
      // byTok.error は必要ならログへ
    }
  }

  // 3) まだ無ければ 401 で返す（/auth へはページ側だけで十分）
  if (!user) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }

  // 4) 管理者チェック（service-role で RLS 無視）
  const sbAdmin = getSbAdmin()
  const { data: prof } = await sbAdmin
    .from('profiles')
    .select('role,is_admin')
    .eq('user_id', user.id)
    .maybeSingle();

  const ok = !!prof && (prof.role === 'admin' || prof.is_admin === true);
  if (!ok) return NextResponse.json({ ok: false }, { status: 403 });

  return { user, prof };
}
