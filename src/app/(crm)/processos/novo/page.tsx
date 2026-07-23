import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { NovoProcessoForm } from './novo-processo-form'

// Cobre a Server Action de busca no DataJud (timeout interno de 35s p/ tribunais
// lentos como o tjba) — sem isso a função da Vercel pode matar a requisição
// antes do timeout do fetch, mascarando o fix com um erro genérico.
export const maxDuration = 45

export default async function NovoProcessoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Parceiro é read-only — RLS já bloqueia o insert, mas nem mostramos o form.
  const { role } = await getAuthUser()
  if (role === 'parceiro') redirect('/processos')

  const AREAS_FIXAS = ['civel', 'trabalhista', 'criminal', 'previdenciario', 'tributario', 'administrativo', 'familia', 'outro']

  const [{ data: clientes }, { data: advogados }, { data: parceiros }, { data: parceirosIndicadores }, { data: areasRows }] = await Promise.all([
    supabase
      .from('clientes')
      .select('id, razao_social')
      .order('razao_social'),
    supabase
      .from('profiles')
      .select('id, full_name')
      .order('full_name'),
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'parceiro')
      .order('full_name'),
    // public.parceiros — indicador comercial SEM login (módulo /parceiros),
    // distinto do parceiro-portal acima (profiles.role='parceiro').
    supabase
      .from('parceiros')
      .select('id, nome')
      .order('nome'),
    // Áreas customizadas (fora das 8 fixas) já usadas por processos da empresa — RLS isola por tenant.
    supabase
      .from('processos_juridicos')
      .select('area')
      .not('area', 'is', null),
  ])

  const areasCustomizadas = [...new Set(
    (areasRows ?? [])
      .map((r) => r.area?.trim())
      .filter((a): a is string => !!a && !AREAS_FIXAS.includes(a)),
  )].sort((a, b) => a.localeCompare(b, 'pt-BR'))

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
        parceiros={(parceiros ?? []).map((p) => ({ id: p.id, full_name: p.full_name }))}
        parceirosIndicadores={(parceirosIndicadores ?? []).map((p) => ({ id: p.id, nome: p.nome }))}
        areasCustomizadas={areasCustomizadas}
      />
    </div>
  )
}
