'use client'

import { useState } from 'react'

export default function ConsentPage() {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setStatus('submitting')
    setMessage(null)
    setError(null)
    try {
      const res = await fetch('/api/consent/accept', {
        method: 'POST',
        credentials: 'same-origin',
      })
      const body = await res.json().catch(() => ({ ok: false, error: res.statusText }))
      if (!res.ok || !body?.ok) {
        throw new Error(body?.error || `status ${res.status}`)
      }
      setStatus('done')
      setMessage('同意を記録しました。ありがとうございます。')
    } catch (err) {
      setStatus('idle')
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">同意の確認</h1>
      <p className="text-sm text-gray-600">
        研究への参加に際し、プライバシーポリシーやデータ取り扱い方針についてご確認のうえ同意してください。
      </p>

      <div className="rounded border bg-white p-4 text-sm text-gray-700">
        <p className="mb-3 font-medium">同意事項（例）</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>収集された食事画像やアンケート回答は匿名化のうえ研究目的で利用します。</li>
          <li>解析結果は研究チームと共有され、統計的に処理されます。</li>
          <li>いつでも退会（ソフト削除）やデータエクスポートが可能です。</li>
        </ul>
      </div>

      <button
        onClick={submit}
        disabled={status === 'submitting'}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-60"
      >
        {status === 'submitting' ? '記録中…' : status === 'done' ? '同意済み' : '同意して進む'}
      </button>

      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </main>
  )
}
