import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { NegocioComRelacoes } from '@/types'
import { listarEstagios } from '@/lib/pipeline-estagios'
import { HistoricoView } from './historico-view'

// ponytail: `desqualificado` ainda não está em NegocioComRelacoes (src/types,
// fora da lane deste stream) — alias local só p/ este arquivo compilar.
type NegocioComDesq = NegocioComRelacoes & { desqualificado?: boolean | null }

export default async function HistoricoPerdidosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profile, estagios] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single().then((r) => r.data),
    listarEstagios(),
  ])

  // Parceiro externo tem 'pipeline' liberado (o portal dele), mas esta tela é
  // interna: mostra motivo_perda e a triagem de desqualificados — comentário do
  // escritório sobre o negócio, não coisa que o indicador deva ler. A visão dele
  // é /pipeline (ver pipeline-parceiro.tsx).
  if (profile?.role === 'parceiro') redirect('/pipeline')

  const slugsPerdidos = estagios.filter((e) => e.tipo === 'perdido').map((e) => e.slug)
  const slugsGanhos = estagios.filter((e) => e.tipo === 'ganho').map((e) => e.slug)
  const slugsFechamento = [...slugsPerdidos, ...slugsGanhos]

  const isComercial = profile?.role === 'comercial'

  // Histórico = TODOS os fechados + desqualificados (o arquivo completo,
  // pesquisável). O kanban é quem arquiva por mês; aqui o usuário busca
  // qualquer negócio fechado ou desqualificado. Desqualificados ficam num
  // estágio ABERTO (fora de slugsFechamento) — por isso o OR com a flag.
  const filtroEstagio = slugsFechamento.length > 0 ? slugsFechamento.join(',') : '__none__'

  let todosNegocios: NegocioComDesq[] = []
  try {
    todosNegocios = await fetchAllRows<NegocioComDesq>((from, to) => {
      let q = supabase
        .from('negocios')
        .select(`
          *,
          clientes ( razao_social ),
          solucoes ( nome ),
          profiles!responsavel_id ( full_name )
        `)
        .or(`estagio.in.(${filtroEstagio}),desqualificado.eq.true`)
        .order('estagio_atualizado_em', { ascending: false })
        .range(from, to)

      if (isComercial) q = q.eq('responsavel_id', user.id)
      return q
    })
  } catch {
    return (
      <div className="flex flex-col gap-6">
        <Header />
        <div className="flex items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 py-10 text-center">
          <p className="text-sm text-destructive">Erro ao carregar histórico. Tente novamente mais tarde.</p>
        </div>
      </div>
    )
  }

  // A flag desqualificado tem precedência: um negócio desqualificado aparece
  // SÓ na aba Desqualificados, nunca em Perdidos/Ganhos (mesmo que o estágio
  // atual seja de fechamento).
  const desqualificados = todosNegocios.filter((n) => n.desqualificado)
  const perdidos = todosNegocios.filter((n) => slugsPerdidos.includes(n.estagio) && !n.desqualificado)
  const ganhos = todosNegocios.filter((n) => slugsGanhos.includes(n.estagio) && !n.desqualificado)

  return (
    <div className="flex flex-col gap-6">
      <Header />
      <HistoricoView perdidos={perdidos} ganhos={ganhos} desqualificados={desqualificados} estagios={estagios} />
    </div>
  )
}

function Header() {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground font-[family-name:var(--font-heading)]">
          Histórico de Fechados
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Negócios perdidos, contratados e desqualificados, agrupados por mês.
        </p>
      </div>
      <Link
        href="/pipeline"
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0')}
      >
        <ArrowLeft className="size-4" />
        Voltar ao Pipeline
      </Link>
    </div>
  )
}
