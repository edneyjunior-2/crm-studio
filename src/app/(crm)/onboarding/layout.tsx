import { requireModulo } from '@/lib/gating'

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireModulo('fluxos')
  return <>{children}</>
}
