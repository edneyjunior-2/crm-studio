import { requireModulo } from '@/lib/gating'

export default async function ObrasLayout({ children }: { children: React.ReactNode }) {
  await requireModulo('obras')
  return <>{children}</>
}
