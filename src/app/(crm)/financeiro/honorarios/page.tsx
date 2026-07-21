import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { HandCoins, Clock, Calculator } from 'lucide-react'
import type { PostgrestError } from '@supabase/supabase-js'
import { getAuthFinanceiro } from '@/lib/auth'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { calcularHonorarios, formatarBRL } from '@/lib/honorarios'
import { StatusBadge } from '@/components/ui/status-badge'
import { marcarRecebido } from '../actions'

type Rows<T> = PromiseLike<{ data: T[] | null; error: PostgrestError | null }>

interface PageProps {
  searchParams: Promise<{ data_inicio?: string; data_fim?: string }>
}

interface ProcessoResumo {
  numero_processo: string
  assunto:         string | null
}

// contas_receber.processo_id é novo (migration 20260721140000) — o tipo global
// ContaReceber (src/types) ainda não inclui esse campo; shape local só com o
// que esta tela precisa (mesmo padrão de tipos locais já usado em
// processos/[id]/page.tsx, ex.: MovRow/PubRow).
interface ContaReceberComProcesso {
  id:               string
  descricao:        string
  valor:            number
  data_vencimento:  string
  data_recebimento: string | null
  status:           string
  processo_id:      string | null
  processo:         ProcessoResumo | null
}

interface ProcessoAberto {
  id:               string
  numero_processo:  string
  assunto:          string | null
  honorarios_tipo:  string | null
  honorarios_valor: number | null
  valor_causa:      number | null
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  atrasado: 'Atrasado',
}

// data_vencimento/data_recebimento são `date` ('YYYY-MM-DD'): parse direto dos
// componentes, sem `new Date()` (evita recuo de fuso horário).
function formatarData(data: string | null): string {
  if (!data) return '—'
  const [ano, mes, dia] = data.slice(0, 10).split('-')
  if (!ano || !mes || !dia) return data
  return `${dia}/${mes}/${ano}`
}

// Embed com hint explícito (convenção do projeto) + alias, mesmo sem ambiguidade
// hoje: contas_receber só tem 1 FK para processos_juridicos (processo_id).
const SELECT_CONTA = 'id, descricao, valor, data_vencimento, data_recebimento, status, processo_id, processo:processos_juridicos!processo_id(numero_processo, assunto)'

export default async function HonorariosPage({ searchParams }: PageProps) {
  const { supabase } = await getAuthFinanceiro()
  const params = await searchParams
  const dataInicio = params.data_inicio ?? ''
  const dataFim = params.data_fim ?? ''

  // 1) Recebidos — honorários já recebidos, respeitando o filtro de período
  // (sobre data_recebimento — histórico, por isso agrupado por mês abaixo).
  let recebidos: ContaReceberComProcesso[] = []
  try {
    recebidos = await fetchAllRows<ContaReceberComProcesso>((from, to) => {
      let q = supabase
        .from('contas_receber')
        .select(SELECT_CONTA)
        .not('processo_id', 'is', null)
        .eq('status', 'recebido')
        .order('data_recebimento', { ascending: false })
        .range(from, to)
      if (dataInicio) q = q.gte('data_recebimento', dataInicio)
      if (dataFim) q = q.lte('data_recebimento', dataFim)
      return q as unknown as Rows<ContaReceberComProcesso>
    })
  } catch (e) {
    console.error('[financeiro/honorarios] erro ao carregar recebidos:', (e as Error).message)
  }

  // 2) A receber — já lançado, aguardando recebimento. Nunca filtrado por
  // período (é "o que existe agora", não histórico).
  let aReceber: ContaReceberComProcesso[] = []
  try {
    aReceber = await fetchAllRows<ContaReceberComProcesso>((from, to) =>
      supabase
        .from('contas_receber')
        .select(SELECT_CONTA)
        .not('processo_id', 'is', null)
        .in('status', ['pendente', 'atrasado'])
        .order('data_vencimento', { ascending: true })
        .range(from, to) as unknown as Rows<ContaReceberComProcesso>
    )
  } catch (e) {
    console.error('[financeiro/honorarios] erro ao carregar contas a receber:', (e as Error).message)
  }

  // 3) Projeção — processos em aberto com honorário configurado mas SEM
  // lançamento em contas_receber ainda (de qualquer status). Exclusão feita em
  // memória: a empresa tem no máximo algumas centenas de processos, não
  // precisa de subquery SQL (mesmo raciocínio da spec).
  let projecao: (ProcessoAberto & { honorario: number })[] = []
  try {
    const [processosAbertos, lancados] = await Promise.all([
      fetchAllRows<ProcessoAberto>((from, to) =>
        supabase
          .from('processos_juridicos')
          .select('id, numero_processo, assunto, honorarios_tipo, honorarios_valor, valor_causa')
          .neq('status', 'concluido')
          .not('honorarios_valor', 'is', null)
          .order('numero_processo', { ascending: true })
          .range(from, to) as unknown as Rows<ProcessoAberto>
      ),
      fetchAllRows<{ processo_id: string }>((from, to) =>
        supabase
          .from('contas_receber')
          .select('processo_id')
          .not('processo_id', 'is', null)
          .range(from, to) as unknown as Rows<{ processo_id: string }>
      ),
    ])
    const idsLancados = new Set(lancados.map((r) => r.processo_id))
    projecao = processosAbertos
      .filter((p) => !idsLancados.has(p.id))
      .map((p) => ({ ...p, honorario: calcularHonorarios(p.honorarios_tipo, p.honorarios_valor, p.valor_causa) }))
      .filter((p): p is ProcessoAberto & { honorario: number } => p.honorario != null)
  } catch (e) {
    console.error('[financeiro/honorarios] erro ao carregar projeção:', (e as Error).message)
  }

  // Agrupa "Recebidos" por mês/ano — mesmo padrão de agrupamento já usado em
  // processos/[id]/page.tsx (gruposMov), só trocando o campo de data.
  const gruposRecebidos: { mes: string; itens: ContaReceberComProcesso[] }[] = []
  for (const r of recebidos) {
    const dataRef = (r.data_recebimento ?? r.data_vencimento).slice(0, 10)
    const [ano, mes] = dataRef.split('-')
    const rotulo = `${MESES[Number(mes) - 1] ?? mes} de ${ano}`
    const ultimo = gruposRecebidos[gruposRecebidos.length - 1]
    if (ultimo && ultimo.mes === rotulo) ultimo.itens.push(r)
    else gruposRecebidos.push({ mes: rotulo, itens: [r] })
  }

  const totalRecebido = recebidos.reduce((s, r) => s + Number(r.valor), 0)
  const totalAReceber = aReceber.reduce((s, r) => s + Number(r.valor), 0)
  const totalProjecao = projecao.reduce((s, p) => s + p.honorario, 0)

  // Inline Server Action (Next.js): reaproveita marcarRecebido — mesma trava
  // atômica contra duplo clique — e só adiciona o revalidate desta rota nova.
  async function marcarHonorarioRecebido(id: string) {
    'use server'
    const hoje = new Date()
    const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
    const res = await marcarRecebido(id, hojeStr)
    if (res.error) console.error('[financeiro/honorarios] erro ao marcar recebido:', res.error)
    revalidatePath('/financeiro/honorarios')
  }

  const filtroInp = 'h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10'

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground font-[family-name:var(--font-heading)]">Honorários</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Honorários de processos: o que já foi recebido, o que está a receber e a projeção do que ainda não foi lançado.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard icon={HandCoins} tone="emerald" label="Total Recebido" value={formatarBRL(totalRecebido)} />
        <KpiCard icon={Clock} tone="blue" label="Total a Receber" value={formatarBRL(totalAReceber)} />
        <KpiCard icon={Calculator} tone="amber" label="Total em Projeção (estimado)" value={formatarBRL(totalProjecao)} />
      </div>

      {/* Recebidos */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold text-foreground">Recebidos</h3>
          <form method="GET" action="/financeiro/honorarios" className="flex flex-wrap items-center gap-2">
            <input type="date" name="data_inicio" defaultValue={dataInicio} className={filtroInp} aria-label="Data início" />
            <span className="text-xs text-muted-foreground">até</span>
            <input type="date" name="data_fim" defaultValue={dataFim} className={filtroInp} aria-label="Data fim" />
            <button
              type="submit"
              className="h-9 rounded-lg border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Filtrar
            </button>
            {(dataInicio || dataFim) && (
              <Link
                href="/financeiro/honorarios"
                className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Limpar
              </Link>
            )}
          </form>
        </div>

        {gruposRecebidos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            Nenhum honorário recebido {dataInicio || dataFim ? 'no período selecionado' : 'ainda'}.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {gruposRecebidos.map((g) => (
              <div key={g.mes} className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.mes}</p>
                <div className="flex flex-col gap-2">
                  {g.itens.map((r) => (
                    <Link
                      key={r.id}
                      href={`/processos/${r.processo_id}`}
                      className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-accent"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {r.processo?.numero_processo ?? r.descricao}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {r.processo?.assunto ?? r.descricao} · Recebido em {formatarData(r.data_recebimento)}
                        </p>
                      </div>
                      <p className="shrink-0 font-mono text-sm font-semibold text-emerald-600">
                        {formatarBRL(Number(r.valor))}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* A Receber */}
      <section className="flex flex-col gap-3">
        <h3 className="text-base font-semibold text-foreground">A Receber</h3>

        {aReceber.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            Nenhum honorário pendente de recebimento.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {aReceber.map((c) => (
              <div
                key={c.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <Link href={`/processos/${c.processo_id}`} className="min-w-0 flex-1 hover:text-primary">
                  <p className="truncate text-sm font-medium text-foreground">
                    {c.processo?.numero_processo ?? c.descricao}
                  </p>
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="truncate">{c.processo?.assunto ?? '—'} · Vence em {formatarData(c.data_vencimento)}</span>
                    <StatusBadge variant={c.status}>{STATUS_LABEL[c.status] ?? c.status}</StatusBadge>
                  </p>
                </Link>
                <div className="flex shrink-0 items-center gap-3">
                  <p className="font-mono text-sm font-semibold text-foreground">{formatarBRL(Number(c.valor))}</p>
                  <form action={marcarHonorarioRecebido.bind(null, c.id)}>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-500/10 dark:text-emerald-400"
                    >
                      Marcar como recebido
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Projeção */}
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Projeção</h3>
          <p className="text-xs text-muted-foreground">
            Estimativa calculada a partir dos processos em aberto que ainda não têm honorário lançado no Financeiro — não é dinheiro confirmado.
          </p>
        </div>

        {projecao.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            Nenhum processo em aberto com honorário pendente de lançamento.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {projecao.map((p) => (
              <Link
                key={p.id}
                href={`/processos/${p.id}`}
                className="flex items-center justify-between gap-4 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 transition-colors hover:bg-accent"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{p.numero_processo}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.assunto ?? '—'}</p>
                </div>
                <p className="shrink-0 font-mono text-sm font-semibold text-muted-foreground" title="Estimado, ainda não lançado">
                  ~{formatarBRL(p.honorario)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType
  label: string
  value: string
  tone: 'emerald' | 'blue' | 'amber'
}) {
  const TONE: Record<string, { bg: string; text: string }> = {
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600' },
    blue:    { bg: 'bg-blue-500/10',    text: 'text-blue-600' },
    amber:   { bg: 'bg-amber-500/10',   text: 'text-amber-600' },
  }
  const c = TONE[tone]
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
      <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${c.bg}`}>
        <Icon className={`size-5 ${c.text}`} />
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`font-mono text-lg font-semibold ${c.text}`}>{value}</p>
      </div>
    </div>
  )
}
