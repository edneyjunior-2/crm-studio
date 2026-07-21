import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { EditarProcessoForm } from './editar-processo-form'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditarProcessoPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Parceiro é read-only — RLS já bloqueia o update, mas nem mostramos o form.
  const { role } = await getAuthUser()
  if (role === 'parceiro') redirect(`/processos/${id}`)

  const AREAS_FIXAS = ['civel', 'trabalhista', 'criminal', 'previdenciario', 'tributario', 'administrativo', 'familia', 'outro']

  const [{ data: processo, error }, { data: clientes }, { data: advogados }, { data: parceiros }, { data: clientesAdicionais }, { data: parceirosIndicadores }, { data: areasRows }, { data: advogadosAdicionais }] = await Promise.all([
    supabase
      .from('processos_juridicos')
      .select('id, numero_processo, assunto, area, vara, comarca, valor_causa, honorarios_tipo, honorarios_valor, cliente_id, advogado_id, parceiro_id, indicador_parceiro_id, polo_passivo_nome, polo_passivo_cpf_cnpj, advogado_adversario_nome, advogado_adversario_oab')
      .eq('id', id)
      .single(),
    supabase.from('clientes').select('id, razao_social').order('razao_social'),
    supabase.from('profiles').select('id, full_name').order('full_name'),
    supabase.from('profiles').select('id, full_name').eq('role', 'parceiro').order('full_name'),
    supabase.from('processos_clientes').select('cliente_id').eq('processo_id', id),
    // public.parceiros — indicador comercial sem login (distinto de parceiros/profiles acima).
    supabase.from('parceiros').select('id, nome').order('nome'),
    // Áreas customizadas (fora das 8 fixas) já usadas por processos da empresa — RLS isola por tenant.
    supabase.from('processos_juridicos').select('area').not('area', 'is', null),
    // 2º advogado responsável (opcional) — hoje só 1 é esperado, pega o 1º/único.
    supabase.from('processos_advogados').select('advogado_id').eq('processo_id', id),
  ])

  if (error || !processo) notFound()

  const areasCustomizadas = [...new Set(
    (areasRows ?? [])
      .map((r) => r.area?.trim())
      .filter((a): a is string => !!a && !AREAS_FIXAS.includes(a)),
  )].sort((a, b) => a.localeCompare(b, 'pt-BR'))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Link
          href={`/processos/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Voltar ao processo
        </Link>
      </div>

      <div>
        <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-tight text-foreground">
          Editar processo
        </h2>
        <p className="mt-1 font-mono text-sm text-muted-foreground">{processo.numero_processo}</p>
      </div>

      <EditarProcessoForm
        processo={{
          id:               processo.id,
          assunto:          processo.assunto,
          area:             processo.area,
          vara:             processo.vara,
          comarca:          processo.comarca,
          valor_causa:      processo.valor_causa,
          honorarios_tipo:  processo.honorarios_tipo,
          honorarios_valor: processo.honorarios_valor,
          cliente_id:                processo.cliente_id,
          clientes_adicionais_ids:   (clientesAdicionais ?? []).map((c) => c.cliente_id),
          advogado_id:               processo.advogado_id,
          advogadoAdicionalId:       (advogadosAdicionais ?? [])[0]?.advogado_id ?? null,
          parceiro_id:               (processo as Record<string, unknown>).parceiro_id as string | null ?? null,
          indicador_parceiro_id:     (processo as Record<string, unknown>).indicador_parceiro_id as string | null ?? null,
          polo_passivo_nome:         (processo as Record<string, unknown>).polo_passivo_nome as string | null ?? null,
          polo_passivo_cpf_cnpj:     (processo as Record<string, unknown>).polo_passivo_cpf_cnpj as string | null ?? null,
          advogado_adversario_nome:  (processo as Record<string, unknown>).advogado_adversario_nome as string | null ?? null,
          advogado_adversario_oab:   (processo as Record<string, unknown>).advogado_adversario_oab as string | null ?? null,
        }}
        clientes={(clientes ?? []).map((c) => ({ id: c.id, razao_social: c.razao_social }))}
        advogados={(advogados ?? []).map((a) => ({ id: a.id, full_name: a.full_name }))}
        parceiros={(parceiros ?? []).map((p) => ({ id: p.id, full_name: p.full_name }))}
        parceirosIndicadores={(parceirosIndicadores ?? []).map((p) => ({ id: p.id, nome: p.nome }))}
        areasCustomizadas={areasCustomizadas}
      />
    </div>
  )
}
