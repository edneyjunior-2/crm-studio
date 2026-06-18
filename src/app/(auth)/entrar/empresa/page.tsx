import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EntrarEmpresaForm } from './form'

export default async function EntrarEmpresaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Usuário já vinculado não tem o que fazer aqui
  const { data: profile } = await supabase
    .from('profiles')
    .select('empresa_id')
    .eq('id', user.id)
    .single()

  if (profile?.empresa_id) redirect('/dashboard')

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 size-96 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="font-logo text-2xl font-extrabold tracking-[-0.03em] text-foreground">
            CRM Studio<span className="text-accent">.</span>
          </span>
          <p className="mt-2 text-sm text-muted-foreground">
            Entre com o código da sua empresa
          </p>
        </div>

        <EntrarEmpresaForm />

        <p className="mt-6 text-center text-xs text-muted-foreground">
          O código de acesso é fornecido pelo administrador da sua empresa.
        </p>
      </div>
    </div>
  )
}
