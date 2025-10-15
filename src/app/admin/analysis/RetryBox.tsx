// app/admin/analysis/RetryBox.tsx
'use client'

import { useState } from 'react'

export default function RetryBox() {
  const [imageId, setImageId] = useState('')
  const [status, setStatus] = useState<number | null>(null)
  const [text, setText] = useState('')

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus(null)
    setText('')

    try {
      const r = await fetch('/api/admin/analysis/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          imageId ? { image_id: Number(imageId) } : { source: 'manual' }
        ),
      })
      setStatus(r.status)
      setText(await r.text())
    } catch (err: any) {
      setStatus(-1)
      setText(String(err))
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ marginTop: 8 }}>
      <label style={{ display: 'block', marginBottom: 8 }}>
        image_id（任意・空ならキュー一括）:
      </label>
      <input
        value={imageId}
        onChange={(e) => setImageId(e.target.value)}
        placeholder="例: 12"
        inputMode="numeric"
        style={{
          border: '1px solid #ccc',
          borderRadius: 6,
          padding: '8px 10px',
          marginRight: 8,
          width: 140,
        }}
      />
      <button
        type="submit"
        style={{
          padding: '8px 12px',
          borderRadius: 8,
          background: '#0b6',
          color: '#fff',
          border: 'none',
        }}
      >
        Re-run
      </button>

      {status !== null && (
        <pre
          style={{
            marginTop: 12,
            background: '#111',
            color: '#0f0',
            padding: 12,
            borderRadius: 8,
            whiteSpace: 'pre-wrap',
          }}
        >
          {`status: ${status}\n${text}`}
        </pre>
      )}
    </form>
  )
}
