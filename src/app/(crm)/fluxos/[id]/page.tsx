import { redirect } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

// A rota /fluxos/[id] foi renomeada para /onboarding/[id].
// Este redirect garante retrocompatibilidade para links antigos.
export default async function FluxoIdRedirectPage({ params }: PageProps) {
  const { id } = await params
  redirect(`/onboarding/${id}`)
}
