import type { Metadata, Viewport } from 'next'
import './globals.css'
import { SwRegister } from '@/components/sw-register'
import { BRAND } from '@/lib/brand'
import { withBase } from '@/lib/base-path'

export const metadata: Metadata = {
  title: `${BRAND.name} Driver`,
  description: `Driver portal for ${BRAND.name} ${BRAND.tagline}`,
  manifest: withBase('/manifest.json'),
  // App icon: gold steering wheel on navy (user choice 17/10/2026), in public/icons.
  icons: {
    icon: [
      { url: withBase('/favicon.ico'), sizes: '16x16 32x32 48x48' },
      { url: withBase('/icons/icon.svg'), type: 'image/svg+xml' },
    ],
    apple: withBase('/icons/apple-touch-icon.png'),
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: BRAND.name,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#020813',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <SwRegister />
      </body>
    </html>
  )
}
