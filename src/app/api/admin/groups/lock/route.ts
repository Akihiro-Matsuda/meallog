import { NextResponse } from 'next/server'
import { getSbAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: Request) {
  try {
    const { meal_ids, lock } = await req.json() as { meal_ids: number[], lock: boolean }
    if (!meal_ids?.length) return NextResponse.json({ error:'meal_ids required' }, { status:400 })

    const sbAdmin = getSbAdmin()
    const { error } = await sbAdmin.from('meals')
      .update({ group_locked: !!lock })
      .in('id', meal_ids)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
