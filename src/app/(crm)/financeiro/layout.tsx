import { requireModulo } from '@/lib/gating'

export default async function FinanceiroLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireModulo('financeiro')
  return <>{children}</>
}
