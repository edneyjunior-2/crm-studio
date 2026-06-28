import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import { SeletorEmpresa } from './seletor-empresa'

export const metadata = { title: 'Selecionar empresa — CRM Studio' }

export default async function SelecionarEmpresaPage() {
  const { supabase, isPlatformAdmin } = await getAuthUser()

  // Apenas platform admins têm acesso a esta rota
  if (!isPlatformAdmin) redirect('/dashboard')

  // RLS de `empresas` já permite platform admin ver todas as empresas
  // (policy: using (id = current_empresa_id() or is_platform_admin()))
  const { data: empresas } = await supabase
    .from('empresas')
    .select('id, nome, status, plano')
    .order('nome')

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 size-96 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg">
        <div className="mb-8 text-center">
          <span className="font-logo text-2xl font-extrabold tracking-[-0.03em] text-foreground">
            CRM Studio<span className="text-accent">.</span>
          </span>
          <p className="mt-2 text-sm text-muted-foreground">
            Escolha qual empresa você deseja acessar
          </p>
        </div>

        <SeletorEmpresa empresas={empresas ?? []} />
      </div>
    </div>
  )
}
