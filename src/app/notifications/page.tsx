'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export default function NotificationsPage() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [status, setStatus] = useState<string>('未設定')
  const [err, setErr] = useState<string | null>(null)
  const [sub, setSub] = useState<PushSubscription | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      setUser((data.user as any) ?? null)
      // SW登録
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.register('/sw.js')
      }
      const reg = await navigator.serviceWorker.ready
      const s = await reg.pushManager.getSubscription()
      setSub(s)
      setStatus(Notification.permission)
    })()
  }, [])

  const subscribe = async () => {
    setErr(null); setLoading(true)
    try {
      if (!user) throw new Error('ログインが必要です')
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') throw new Error('通知が許可されませんでした')
      const reg = await navigator.serviceWorker.ready
      const s = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID),
      })
      setSub(s); setStatus('granted')
      // DB に保存（RLSで自分の行のみ）
      const body = s.toJSON() as any
      const { error } = await supabase.from('device_subscriptions').upsert({
        user_id: user.id,
        endpoint: body.endpoint,
        keys: body.keys,
      })
      if (error) throw error
    } catch (e: any) {
      setErr(e.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }

  const unsubscribe = async () => {
    setErr(null); setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const s = await reg.pushManager.getSubscription()
      if (s) {
        const endpoint = s.endpoint
        await s.unsubscribe()
        await supabase.from('device_subscriptions').delete().eq('endpoint', endpoint)
        setSub(null); setStatus(Notification.permission)
      }
    } catch (e: any) {
      setErr(e.message ?? String(e))
    } finally { setLoading(false) }
  }

  const sendTest = async () => {
    setErr(null); setLoading(true)
    try {
      if (!sub) throw new Error('購読がありません')
      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          title: 'MealLog テスト',
          body: '通知の受信テストです',
          url: '/meals/new'
        })
      })
      if (!res.ok) throw new Error(await res.text())
    } catch (e: any) {
      setErr(e.message ?? String(e))
    } finally { setLoading(false) }
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">通知設定</h1>
      <p className="text-sm text-gray-600">状態: {status}</p>

      <div className="flex gap-2">
        <button onClick={subscribe} disabled={loading} className="rounded bg-black text-white px-3 py-2">
          許可して購読する
        </button>
        <button onClick={unsubscribe} disabled={loading} className="rounded border px-3 py-2">
          購読解除
        </button>
        <button onClick={sendTest} disabled={loading || !sub} className="rounded border px-3 py-2">
          テスト送信
        </button>
      </div>

      {err && <p className="text-red-700 text-sm">{err}</p>}
      <div className="pt-4"><Link href="/" className="underline text-blue-600">ホームへ</Link></div>
    </div>
  )
}
