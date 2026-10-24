import type { Metadata, Viewport } from 'next'
import '@fontsource/lilita-one/400.css'
import '@fontsource/rubik/500.css'
import '@fontsource/rubik/700.css'
import '@fontsource/rubik/800.css'
import '@fontsource/rubik/900.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/700.css'
import './globals.css'
import { Providers } from './providers'


export const metadata: Metadata = {
  title: 'DuckWek · live duck racing on Monad',
  description: 'Scan, connect, race. One race step per Monad block. USDC only, gas on us, no prize pool.',
  icons: { icon: '/logo-mark.png', apple: '/logo-mark.png' },
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 1, themeColor: '#836EF9' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
