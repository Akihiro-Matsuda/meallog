export const runtime = 'nodejs'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import webpush from 'web-push'

webpush.setVapidDetails(
  'mailto:example@example.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { subscription, title, body, url } = await req.json()
    await webpush.sendNotification(subscription, JSON.stringify({ title, body, url }))
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return new NextResponse(String(e), { status: 500 })
  }
}
