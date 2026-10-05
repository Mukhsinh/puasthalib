import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
})

export const metadata: Metadata = {
  title: 'PUAS - Kanal Aduan, Survey dan Informasi',
  description: 'Aplikasi Manajemen Layanan Cepat dan Modern',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={`${plusJakartaSans.variable} font-sans min-h-screen bg-background`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
