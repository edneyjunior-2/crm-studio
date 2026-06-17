import { requireModulo } from '@/lib/gating'

export default async function FluxosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireModulo('fluxos')
  return <>{children}</>
}
