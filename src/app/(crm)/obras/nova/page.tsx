import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NovaObraForm } from './nova-obra-form'

export default async function NovaObraPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: clientes }, { data: profiles }] = await Promise.all([
    supabase.from('clientes').select('id, razao_social').order('razao_social'),
    supabase.from('profiles').select('id, full_name').order('full_name'),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-tight text-foreground">
          Nova Obra
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cadastre um novo projeto ou contrato de construção civil.
        </p>
      </div>
      <NovaObraForm
        clientes={(clientes ?? []).map((c) => ({ id: c.id, razao_social: c.razao_social }))}
        responsaveis={(profiles ?? []).map((p) => ({ id: p.id, full_name: p.full_name }))}
      />
    </div>
  )
}
