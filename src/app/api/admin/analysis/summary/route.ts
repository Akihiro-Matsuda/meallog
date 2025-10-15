import { NextResponse } from 'next/server'
import { sbAdmin } from '@/lib/supabaseAdmin'

export async function GET() {
  const since = new Date(Date.now() - 7 * 86400000).toISOString() // 直近7日

  const [doneCnt, errCnt, queuedCnt] = await Promise.all([
    sbAdmin.from('meal_image_analysis').select('image_id', { count: 'exact', head: true }).gte('ran_at', since).eq('status', 'done'),
    sbAdmin.from('meal_image_analysis').select('image_id', { count: 'exact', head: true }).gte('ran_at', since).eq('status', 'error'),
    sbAdmin.from('jobs').select('id', { count: 'exact', head: true }).eq('job_type', 'analyze_meal').eq('status', 'queued'),
  ])

  return NextResponse.json({
    ok: true,
    since,
    counts: {
      done: doneCnt.count ?? 0,
      error: errCnt.count ?? 0,
      queued: queuedCnt.count ?? 0,
    },
  })
}