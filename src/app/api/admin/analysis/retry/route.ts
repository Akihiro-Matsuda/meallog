import { requireAdmin } from '@/app/api/admin/_lib/requireAdmin'
import { getSbAdmin } from '@/app/api/admin/_lib/requireAdmin'
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // ⬇️ ここがポイント：requireAdmin が Response を返したら、そのまま返す
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  const { user } = auth; // ここに来たら admin OK
  return Response.json({ ok: true, user_id: user.id });
}

export async function POST(req: Request) {
  // Bearer/Cookie 両対応のゲート（req を渡すのを忘れない）
  const gate = await requireAdmin(req)
  if (gate instanceof Response) return gate  // 401/403

  const admin = getSbAdmin()

  // ここから先は admin を使う
  const body = await req.json().catch(() => ({}))
  const imageId = body?.image_id as number | undefined

  if (!imageId) {
    return new Response(JSON.stringify({ ok: false, error: 'image_id is required' }), { status: 400 })
  }

  // 例：jobs へ enqueue（あなたの既存ロジックに合わせて）
  const { data: img, error: imgErr } = await admin
    .from('meal_images')
    .select('id, meal_id, storage_path')
    .eq('id', imageId)
    .maybeSingle()

  if (imgErr || !img) {
    return new Response(JSON.stringify({ ok: false, error: imgErr?.message ?? 'image not found' }), { status: 404 })
  }

  const { data: meal, error: mealErr } = await admin
    .from('meals')
    .select('id, deleted_at')
    .eq('id', img.meal_id)
    .maybeSingle()
  if (mealErr) {
    return new Response(JSON.stringify({ ok: false, error: mealErr.message }), { status: 500 })
  }
  if (!meal || meal.deleted_at) {
    return new Response(JSON.stringify({ ok: false, error: 'meal is deleted' }), { status: 400 })
  }

  const payload = { meal_id: img.meal_id, image_id: img.id, storage_path: img.storage_path }
  const { error: insErr } = await admin.from('jobs').insert({
    job_type: 'analyze_meal',
    payload,
    status: 'queued',
    run_at: new Date().toISOString(),
  })

  if (insErr) {
    return new Response(JSON.stringify({ ok: false, error: insErr.message }), { status: 500 })
  }

  return new Response(JSON.stringify({ ok: true, queued: true }), { status: 200 })
}
