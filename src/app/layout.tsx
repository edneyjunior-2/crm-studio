import type { Metadata } from 'next'
import { Archivo, Space_Grotesk, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'

// Tipografia CRM Studio:
//   Logo      → Archivo            (--font-logo)
//   Display   → Space Grotesk      (--font-heading — títulos/headings)
//   Corpo/UI  → IBM Plex Sans      (--font-body)
//   Labels    → IBM Plex Mono      (--font-mono — rótulos, números)

const archivo = Archivo({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-logo',
  display: 'swap',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-heading',
  display: 'swap',
})

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'CRM Studio · Vendas, financeiro e equipe em um só lugar',
  description:
    'CRM brasileiro para PMEs: pipeline de vendas, módulo financeiro e calendário integrado ao Google. Organize seu time comercial sem planilha.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${archivo.variable} ${spaceGrotesk.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  )
}
