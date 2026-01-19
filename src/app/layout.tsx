import type { Metadata } from 'next'
import { Figtree } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const figtree = Figtree({
  subsets: ['latin'],
  variable: '--font-figtree',
})

export const metadata: Metadata = {
  title: 'LGS Admin Panel',
  description: 'Panel administrativo completo para Let\'s Go Speak',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={`${figtree.variable} font-sans`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}