import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: { extend: { colors: { ink: '#f6f7f9', surface: '#ffffff', card: '#ffffff', accent: '#f0506e', muted: '#64748b' } } },
  plugins: [],
}
export default config
