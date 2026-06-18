import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NovoProcessoForm } from './novo-processo-form'

export default async function NovoProcessoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: clientes }, { data: advogados }] = await Promise.all([
    supabase
      .from('clientes')
      .select('id, razao_social')
      .order('razao_social'),
    supabase
      .from('profiles')
      .select('id, full_name')
      .order('full_name'),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-tight text-foreground">
          Novo Processo
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Informe o número CNJ para buscar automaticamente os dados no DataJud.
        </p>
      </div>

      <NovoProcessoForm
        clientes={(clientes ?? []).map((c) => ({ id: c.id, razao_social: c.razao_social }))}
        advogados={(advogados ?? []).map((a) => ({ id: a.id, full_name: a.full_name }))}
      />
    </div>
  )
}
