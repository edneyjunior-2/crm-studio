import type { Metadata } from 'next'
import { Libre_Baskerville, Inter } from 'next/font/google'
import localFont from 'next/font/local'
import './globals.css'

// Tipografia oficial Aurum:
//   Primária  → Libre Baskerville (títulos, headings)
//   Secundária → NEXA (corpo, UI, navegação)
//
// Para ativar o NEXA:
//   1. Obtenha os arquivos .woff2 com a empresa que criou a marca
//   2. Salve em /public/fonts/Nexa-Regular.woff2  e  /public/fonts/Nexa-Bold.woff2
//   3. Remova o coment abaixo e exclua o import do Inter

const libreBaskerville = Libre_Baskerville({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-heading',
  display: 'swap',
})

// Fallback enquanto os arquivos da NEXA não são adicionados
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

// Descomente quando os arquivos Nexa estiverem em /public/fonts/:
// const nexa = localFont({
//   src: [
//     { path: '../../public/fonts/Nexa-Regular.woff2', weight: '400', style: 'normal' },
//     { path: '../../public/fonts/Nexa-Bold.woff2',    weight: '700', style: 'normal' },
//   ],
//   variable: '--font-body',
//   fallback: ['system-ui', 'sans-serif'],
//   display: 'swap',
// })

export const metadata: Metadata = {
  title: 'CRM Aurum',
  description: 'CRM de representação comercial multi-solução',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${libreBaskerville.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  )
}
