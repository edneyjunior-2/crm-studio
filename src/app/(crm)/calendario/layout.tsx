import { requireModulo } from '@/lib/gating'

export default async function CalendarioLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireModulo('calendario')
  return <>{children}</>
}
