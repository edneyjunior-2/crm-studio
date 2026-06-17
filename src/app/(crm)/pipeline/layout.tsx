import { requireModulo } from '@/lib/gating'

export default async function PipelineLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireModulo('pipeline')
  return <>{children}</>
}
