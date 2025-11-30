'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

function parseHashParams(hash: string): Record<string, string> {
  // "#access_token=...&refresh_token=..." を { access_token: "...", ... } にする
  const h = hash.startsWith('#') ? hash.slice(1) : hash
  return Object.fromEntries(new URLSearchParams(h).entries())
}

function CallbackPageInner() {
  const router = useRouter()
  const params = useSearchParams()
  const [message, setMessage] = useState('ログイン処理中…')

  useEffect(() => {
    (async () => {
      try {
        // 1) ?code=... に対応（OAuth/PKCE 形式）
        const code = params.get('code')
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
          setMessage('ログイン成功。トップに移動します…')
          router.replace('/')
          return
        }

        // 2) ?token_hash=...&type=... に対応（verifyOtp 形式）
        const token_hash = params.get('token_hash')
        const type = params.get('type') as
          | 'magiclink'
          | 'recovery'
          | 'email_change'
          | 'signup'
          | null

        if (token_hash && type) {
          const { error } = await supabase.auth.verifyOtp({ token_hash, type })
          if (error) throw error
          setMessage('ログイン成功。トップに移動します…')
          router.replace('/')
          return
        }

        // 3) #access_token=...&refresh_token=... に対応（ハッシュにトークン）
        const { access_token, refresh_token } = parseHashParams(window.location.hash)
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token })
          if (error) throw error
          setMessage('ログイン成功。トップに移動します…')
          router.replace('/')
          return
        }

        // どれにも該当しない
        setMessage('コードまたはトークンが見つかりませんでした')
      } catch (e: any) {
        setMessage(`セッション確立に失敗: ${e?.message ?? String(e)}`)
      }
    })()
  }, [params, router])

  return <div className="p-6">{message}</div>
}

export default function CallbackPage() {
  return (
    <Suspense fallback={<div className="p-6">ログイン処理中…</div>}>
      <CallbackPageInner />
    </Suspense>
  )
}
