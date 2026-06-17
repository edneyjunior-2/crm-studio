import { requireModulo } from '@/lib/gating'

export default async function ComissoesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireModulo('comissoes')
  return <>{children}</>
}
