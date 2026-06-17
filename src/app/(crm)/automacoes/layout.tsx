import { requireModulo } from '@/lib/gating'

export default async function AutomacoesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireModulo('automacoes')
  return <>{children}</>
}
