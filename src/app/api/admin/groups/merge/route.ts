import { NextResponse } from 'next/server'
import { getSbAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: Request) {
  try {
    const { source_meal_ids, target_group_id } = await req.json() as {
      source_meal_ids: number[], target_group_id?: string
    }
    if (!source_meal_ids?.length) {
      return NextResponse.json({ error: 'source_meal_ids required' }, { status: 400 })
    }

    // 指定がなければ先頭 meal の group を代表に
    const sbAdmin = getSbAdmin()

    let groupId = target_group_id
    if (!groupId) {
      const { data: m } = await sbAdmin.from('meals')
        .select('intake_group_id').eq('id', source_meal_ids[0]).maybeSingle()
      groupId = m?.intake_group_id ?? crypto.randomUUID()
    }

    // ロック解除してグループ付け替え
    const { error } = await sbAdmin.from('meals')
      .update({ intake_group_id: groupId, group_locked: false })
      .in('id', source_meal_ids)
    if (error) throw error

    return NextResponse.json({ ok: true, group_id: groupId })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
