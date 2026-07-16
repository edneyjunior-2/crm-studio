import { requireModulo } from '@/lib/gating'

export default async function FreteLayout({ children }: { children: React.ReactNode }) {
  await requireModulo('frete')
  return <>{children}</>
}
