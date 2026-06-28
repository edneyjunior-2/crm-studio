import { requireModulo } from '@/lib/gating'

export default async function ProcessosLayout({ children }: { children: React.ReactNode }) {
  await requireModulo('processos')
  return <>{children}</>
}
