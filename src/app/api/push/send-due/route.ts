export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { toZonedTime, formatInTimeZone } from 'date-fns-tz'

webpush.setVapidDetails(
  'mailto:example@example.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

const sb = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // server-only
  { auth: { persistSession: false } }
)

type Sub = { endpoint: string; keys: any }
type ProfileRow = {
  user_id: string
  timezone: string
  breakfast_time: string | null
  lunch_time: string | null
  dinner_time: string | null
}

function isDue(nowUtc: Date, timeStr: string, tz: string, windowMin = 5) {
  const [hh, mm] = timeStr.split(':').map((v) => parseInt(v, 10))
  const nowLocal = toZonedTime(nowUtc, tz)
  const targetLocal = new Date(nowLocal)
  targetLocal.setHours(hh, mm, 0, 0)
  const diff = Math.abs(nowLocal.getTime() - targetLocal.getTime()) / 60000
  return diff <= windowMin
}

async function runSendDue(opts: { windowMin?: number; force?: boolean } = {}) {
  const windowMin = opts.windowMin ?? 5
  const force = opts.force ?? false
  const nowUtc = new Date()
  let sent = 0, removedInvalid = 0, dueUsers = 0

  // 1) profiles を取得（埋め込みなし）
  const { data: profiles, error: profErr } = await sb
    .from('profiles')
    .select('user_id, timezone, breakfast_time, lunch_time, dinner_time')
  if (profErr) return new NextResponse(profErr.message, { status: 500 })
  if (!profiles?.length) {
    return NextResponse.json({ ok: true, dueUsers: 0, sent: 0, removedInvalid: 0, now: nowUtc.toISOString() })
  }

  const userIds = profiles.map((p: any) => p.user_id)

  // 2) 購読をまとめて取得
  const { data: subs, error: subErr } = await sb
    .from('device_subscriptions')
    .select('user_id, endpoint, keys')
    .in('user_id', userIds)
  if (subErr) return new NextResponse(subErr.message, { status: 500 })

  const subsByUser = new Map<string, Sub[]>()
  for (const s of subs ?? []) {
    const arr = subsByUser.get(s.user_id) ?? []
    arr.push({ endpoint: s.endpoint, keys: s.keys })
    subsByUser.set(s.user_id, arr)
  }

  // 3) 判定→送信
  for (const u of profiles as ProfileRow[]) {
    const userSubs = subsByUser.get(u.user_id) ?? []
    if (!userSubs.length) continue

    const tz = u.timezone || 'Asia/Tokyo'
    const localDateStr = formatInTimeZone(nowUtc, tz, 'yyyy-MM-dd')
    const targets: Array<'breakfast' | 'lunch' | 'dinner'> = []

    // ★ force のときは時刻チェックを無視して、設定があるスロット全部を送る
    if (force) {
      if (u.breakfast_time) targets.push('breakfast')
      if (u.lunch_time)     targets.push('lunch')
      if (u.dinner_time)    targets.push('dinner')
    } else {
      if (u.breakfast_time && isDue(nowUtc, u.breakfast_time, tz, windowMin)) targets.push('breakfast')
      if (u.lunch_time     && isDue(nowUtc, u.lunch_time, tz, windowMin))     targets.push('lunch')
      if (u.dinner_time    && isDue(nowUtc, u.dinner_time, tz, windowMin))    targets.push('dinner')
    }

    for (const slot of targets) {
      // 同日・同スロット重複防止（ユニーク制約活用）
      const ins = await sb.from('notifications_log').insert({
        user_id: u.user_id, slot, sent_local_date: localDateStr as any
      }).select('id').single()

      if (ins.error && !String(ins.error.message).includes('duplicate key')) {
        continue // 想定外はスキップ
      }
      if (!ins.data) continue // 既に送信済み

      const payload = JSON.stringify({
        title: '食事記録のリマインド',
        body: `そろそろ${slot === 'breakfast' ? '朝食' : slot === 'lunch' ? '昼食' : '夕食'}の記録をお願いします`,
        url: '/meals/new'
      })

      for (const s of userSubs) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload)
          sent++
        } catch (e: any) {
          const msg = String(e?.message ?? '')
          if (msg.includes('410') || msg.includes('404')) {
            await sb.from('device_subscriptions').delete().eq('endpoint', s.endpoint)
            removedInvalid++
          }
        }
      }
    }
  }

  return NextResponse.json({ ok: true, dueUsers, sent, removedInvalid, now: nowUtc.toISOString(), windowMin, force })
}

// GET/POST でクエリを受け取る
export async function GET(req: Request) {
  const url = new URL(req.url)
  const windowMin = parseInt(url.searchParams.get('window') ?? '5', 10)
  const force = url.searchParams.get('force') === '1'
  return runSendDue({ windowMin, force })
}

export async function POST(req: Request) {
  const url = new URL(req.url)
  const windowMin = parseInt(url.searchParams.get('window') ?? '5', 10)
  const force = url.searchParams.get('force') === '1'
  return runSendDue({ windowMin, force })
}
