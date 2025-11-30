import { NextResponse } from 'next/server'
import { getSbAdmin } from '@/lib/supabaseAdmin'

export async function GET() {
  const sbAdmin = getSbAdmin()
  const { data, error } = await sbAdmin
    .from('meal_image_analysis')
    .select(`
      image_id,
      meal_id,
      status,
      ran_at,
      error,
      raw_response,
      meals:meal_id ( meal_slot, taken_at ),
      img:meal_images!meal_image_analysis_image_id_fkey ( storage_path )
    `)
    .order('image_id', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, rows: data })
}
