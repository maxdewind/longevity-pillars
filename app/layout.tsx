import type { Metadata, Viewport } from 'next'
import './globals.css'
import SiteChrome from '@/components/SiteChrome'

export const metadata: Metadata = {
  title: 'Longevity Pillars',
  description: 'Quit ultra-processed food. Craving support from day one through month six.',
  manifest: '/manifest.json',
  icons: { apple: '/apple-touch-icon.png' },
}

export const viewport: Viewport = {
  themeColor: '#14161d',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><SiteChrome>{children}</SiteChrome></body>
    </html>
  )
}
