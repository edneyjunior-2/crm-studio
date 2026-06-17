import { requireModulo } from '@/lib/gating'

export default async function ContratosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireModulo('contratos')
  return <>{children}</>
}
