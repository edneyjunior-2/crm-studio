import { requireModulo } from '@/lib/gating'

export default async function SolucoesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireModulo('solucoes')
  return <>{children}</>
}
