import { requireModulo } from '@/lib/gating'

export default async function HonorariosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireModulo('processos')
  return <>{children}</>
}
