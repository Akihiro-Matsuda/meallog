// .eslintrc.cjs
const isCI = process.env.VERCEL === '1' || process.env.CI === 'true'

module.exports = {
  root: true,
  extends: ['next/core-web-vitals'],
  rules: {
    // 本番ビルドでは off（ローカルでは warn などに）
    '@typescript-eslint/no-explicit-any': isCI ? 'off' : 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'prefer-const': isCI ? 'off' : 'warn',
  },
}