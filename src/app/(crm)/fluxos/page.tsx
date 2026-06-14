import { redirect } from 'next/navigation'

// A rota /fluxos foi renomeada para /onboarding.
// Este redirect garante retrocompatibilidade para links antigos.
export default function FluxosRedirectPage() {
  redirect('/onboarding')
}
