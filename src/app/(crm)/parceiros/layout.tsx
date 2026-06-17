import { requireModulo } from '@/lib/gating'

export default async function ParceirosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireModulo('parceiros')
  return <>{children}</>
}
