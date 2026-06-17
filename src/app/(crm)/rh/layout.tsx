import { requireModulo } from '@/lib/gating'

export default async function RhLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireModulo('rh')
  return <>{children}</>
}
