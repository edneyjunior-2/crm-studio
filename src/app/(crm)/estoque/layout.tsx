import { requireModulo } from '@/lib/gating'

export default async function EstoqueLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireModulo('estoque')
  return <>{children}</>
}
