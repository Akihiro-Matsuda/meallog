'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { HomeInlineButton } from '@/components/HomeInlineButton'

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
      if (sub) return
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
      }, { onConflict: 'endpoint' })
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
      if (!s) throw new Error('購読がありません')
      const endpoint = s.endpoint
      await s.unsubscribe()
      await supabase.from('device_subscriptions').delete().eq('endpoint', endpoint)
      setSub(null); setStatus(Notification.permission)
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

  const subscribed = !!sub

  const permissionNote = (() => {
    if (status === 'granted') return 'ブラウザで通知が許可されています。下の通知設定を有効にするとリマインドを受信できます。'
    if (status === 'denied') return 'ブラウザで通知が拒否されています。ブラウザや端末の設定から通知を許可してください。'
    return 'まだ通知許可がされていません。「通知を許可」を押して通知を許可してください。'
  })()

  const permissionLabel = status === 'granted' ? '許可済み' : status === 'denied' ? '拒否' : '未設定'
  const subscriptionLabel = subscribed ? '購読中' : '未購読'

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-slate-50">
      <div className="mx-auto max-w-xl px-5 py-6 space-y-5">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-amber-700 font-semibold">settings</p>
              <h1 className="text-2xl font-bold text-slate-900">通知設定</h1>
            </div>
            <HomeInlineButton />
          </div>
          <p className="text-sm text-slate-700">
            リマインドを受け取るために通知を許可してください。
          </p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-white/90 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">ブラウザの通知許可</p>
            <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800 font-semibold">
              {permissionLabel}
            </span>
          </div>
          <p className="text-sm text-slate-700">{permissionNote}</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-white/90 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">通知設定</p>
            <span
              className={`text-xs px-2 py-1 rounded-full font-semibold ${
                subscribed ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {subscriptionLabel}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              onClick={subscribe}
              disabled={loading || subscribed}
              className={`w-full rounded-lg px-3 py-3 font-semibold transition disabled:cursor-default disabled:opacity-100 ${
                subscribed ? 'bg-amber-500 text-white hover:bg-amber-600' : 'border border-slate-200 bg-white text-slate-800 hover:border-amber-400'
              }`}
            >
              通知を許可
            </button>
            <button
              onClick={unsubscribe}
              disabled={loading || !subscribed}
              className={`w-full rounded-lg px-3 py-3 text-sm font-semibold transition disabled:cursor-default disabled:opacity-100 ${
                subscribed ? 'border border-slate-200 bg-white text-slate-800 hover:border-amber-400' : 'bg-amber-500 text-white hover:bg-amber-600'
              }`}
            >
              通知を解除
            </button>
            <button onClick={sendTest} disabled={loading || !sub} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 hover:border-amber-400 disabled:opacity-60 transition">
              テスト送信
            </button>
          </div>

          {err && <p className="text-red-700 text-sm">{err}</p>}
        </div>

        <div className="text-left text-xs text-slate-500">
          iOS SafariではインストールしたWebアプリ（ホーム画面追加）でのみ通知を受け取れるなど、端末によって挙動が異なります。
        </div>
      </div>
    </main>
  )
}
