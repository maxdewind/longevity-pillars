import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: { extend: { colors: { ink: '#14161d', surface: '#1c1f28', card: '#20242e', accent: '#f0506e', muted: '#9aa0ae' } } },
  plugins: [],
}
export default config
