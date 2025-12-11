'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function HeaderHomeLink() {
  const pathname = usePathname() || '/'
  if (pathname === '/') return null
  return (
    <Link href="/" className="text-sm text-blue-700 hover:underline">
      ← ホームに戻る
    </Link>
  )
}
