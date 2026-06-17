import { requireModulo } from '@/lib/gating'

export default async function ClientesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireModulo('clientes')
  return <>{children}</>
}
