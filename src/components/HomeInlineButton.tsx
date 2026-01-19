'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function HomeInlineButton() {
  const pathname = usePathname() || '/'
  if (pathname === '/') return null
  return (
    <Link
      href="/"
      className="text-sm text-slate-600 underline decoration-amber-500 decoration-2 underline-offset-4"
    >
      ホームに戻る
    </Link>
  )
}
