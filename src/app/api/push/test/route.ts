export const runtime = 'nodejs'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import webpush from 'web-push'

export async function POST(req: NextRequest) {
  try {
    const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const priv = process.env.VAPID_PRIVATE_KEY
    if (!pub || !priv) throw new Error('VAPID env missing')
    webpush.setVapidDetails('mailto:example@example.com', pub, priv)

    const { subscription, title, body, url } = await req.json()
    await webpush.sendNotification(subscription, JSON.stringify({ title, body, url }))
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return new NextResponse(String(e), { status: 500 })
  }
}
