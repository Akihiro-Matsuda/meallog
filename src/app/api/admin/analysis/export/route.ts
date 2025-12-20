import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_lib/requireAdmin'
import { createClient } from '@supabase/supabase-js'

// JST の日付範囲（start/end は 'YYYY-MM-DD' 文字列、未指定なら今日）
function jstRange(start?: string | null, end?: string | null) {
  // "YYYY-MM-DD" → JST の 00:00 を基準に UTC ISO 範囲へ
  const toJstStart = (s: string) => {
    const [y, m, d] = s.split('-').map(Number)
    // JST 00:00 を UTC に直した ISO（Date.UTC は UTC 時刻を生成）
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0))
  }

  if (start && end) {
    const s = toJstStart(start)
    const e = toJstStart(end)
    // end は“当日終端”にしたいので +1 日して半開区間に
    const endExclusive = new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate() + 1, 0, 0, 0))
    return {
      startIso: s.toISOString(),
      endIso: endExclusive.toISOString(),
      filenameDate: `${start}_to_${end}`
    }
  }

  // 単一日の場合（今日）
  const now = new Date()
  const y = now.getUTCFullYear(), m = now.getUTCMonth(), d = now.getUTCDate()
  const startUtc = new Date(Date.UTC(y, m, d, 0, 0, 0))
  const endUtc   = new Date(Date.UTC(y, m, d + 1, 0, 0, 0))
  const yyyy = now.toISOString().slice(0, 10) // UTC基準だがファイル名用途のみ
  return { startIso: startUtc.toISOString(), endIso: endUtc.toISOString(), filenameDate: yyyy }
}

// CSV エスケープ
function esc(v: any) {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET(req: Request) {
  // Bearer / Cookie 両対応のゲート（req を渡すのを忘れない）
  const gate = await requireAdmin(req)
  if (gate instanceof Response) return gate // 401/403 をそのまま返す

  const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SB_URL || !SRK) {
    return new NextResponse('Supabase env missing', { status: 500 })
  }

  // 各リクエストごとに service-role クライアントを生成（トップレベル評価を避ける）
  const admin = createClient(SB_URL, SRK, { auth: { persistSession: false } })

  const url = new URL(req.url)
  const start = url.searchParams.get('start') // 'YYYY-MM-DD' 省略可
  const end   = url.searchParams.get('end')   // 'YYYY-MM-DD' 省略可
  const { startIso, endIso, filenameDate } = jstRange(start, end)

  // Colab と同じ列順を維持
  const header = [
    'meal_id','image_id','start_time',
    'carbs_g','fat_g','protein_g','fiber_g','GI','alcohol_ml','image_blur_flag',
    'category_count','category_overflow_flag','cat1','cat2','cat3','cat4','cat5'
  ] as const

  const { data, error } = await admin
    .from('meal_image_analysis')
    .select(`
      meal_id,
      image_id,
      start_time,
      carbs_g,
      fat_g,
      protein_g,
      fiber_g,
      GI,
      alcohol_ml,
      image_blur_flag,
      category_count,
      category_overflow_flag,
      cat1,cat2,cat3,cat4,cat5
    `)
    .gte('start_time', startIso)
    .lt('start_time', endIso)
    .order('start_time', { ascending: true })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const rows = (data ?? []).map((r) => header.map((k) => (r as any)[k] ?? ''))
  const bom = '\uFEFF'
  const csv = [header.join(','), ...rows.map(cols => cols.map(esc).join(','))].join('\n')

  return new Response(bom + csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="meal_image_analysis_${filenameDate}.csv"`,
      'cache-control': 'no-store',
    }
  })
}
