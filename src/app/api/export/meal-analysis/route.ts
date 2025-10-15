export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.SUPABASE_URL!,                // server-only
  process.env.SUPABASE_SERVICE_ROLE_KEY!,   // server-only
  { auth: { persistSession: false } }
)

export async function GET() {
  // 1) ビューから取得
  const { data, error } = await sb.from('meal_analysis_csv').select('*').order('meal_id', { ascending: true })
  if (error) return new NextResponse(error.message, { status: 500 })
  if (!data?.length) return new NextResponse('no data', { status: 200 })

  // 2) CSV 生成（Colabヘッダ順）
  const header = ["meal_id","start_time","carbs_g","fat_g","protein_g","fiber_g","GI","alcohol_ml","image_blur_flag","category_count","category_overflow_flag","cat1","cat2","cat3","cat4","cat5"]
  const lines = [
    header.join(','),
    ...data.map((r: any) => header.map(h => (r[h] ?? '')).join(','))
  ]
  const csv = lines.join('\n')

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="meal_record.csv"`
    }
  })
}
