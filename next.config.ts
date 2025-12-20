// next.config.ts
import type { NextConfig } from 'next'

const isCI = process.env.VERCEL === '1' || process.env.CI === 'true'

const nextConfig: NextConfig = {
  // 型エラーはCI環境のみ無視（必要に応じて外してください）
  typescript: { ignoreBuildErrors: isCI },
}

export default nextConfig
