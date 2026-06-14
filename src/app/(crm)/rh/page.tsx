import { Suspense } from 'react'
import { Plus, CalendarMinus, DollarSign, Users } from 'lucide-react'
import { getAuthAdmin } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ColaboradoresTable } from '@/components/crm/rh/colaboradores-table'
import { ColaboradorForm } from '@/components/crm/rh/colaborador-form'
import { AusenciaForm } from '@/components/crm/rh/ausencia-form'
import { FolhaSimples, LancamentoFormDialog } from '@/components/crm/rh/folha-simples'
import type { Colaborador, Ausencia, LancamentoFolha } from '@/types/rh'

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

// ============================================================================
// KPI card
// ============================================================================
function KpiCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: React.ElementType
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card px-5 py-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </div>
      <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
    </div>
  )
}

// ============================================================================
// Conteúdo principal (server component assíncrono, dentro de Suspense)
// ============================================================================
async function RhContent() {
  const { supabase } = await getAuthAdmin()

  // Colaboradores
  const { data: colaboradoresRaw, error: errColaboradores } = await supabase
    .from('colaboradores')
    .select('*')
    .order('nome', { ascending: true })

  if (errColaboradores) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 py-10 text-center">
        <p className="text-sm text-destructive">
          Erro ao carregar colaboradores: {errColaboradores.message}
        </p>
      </div>
    )
  }

  const colaboradores = (colaboradoresRaw ?? []) as Colaborador[]
  const ativos = colaboradores.filter((c) => c.status === 'ativo')

  // Custo de folha do mês atual (Σ salário dos colaboradores ativos)
  // Leitura: salário cadastrado no colaborador, não de lancamentos_folha — é a visão rápida de custo estimado.
  const custoFolhaMes = ativos.reduce((acc, c) => acc + (c.salario ?? 0), 0)

  // Ausências
  const { data: ausenciasRaw, error: errAusencias } = await supabase
    .from('ausencias')
    .select('*, colaborador:colaboradores(id, nome)')
    .order('data_inicio', { ascending: false })

  if (errAusencias) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 py-10 text-center">
        <p className="text-sm text-destructive">
          Erro ao carregar ausências: {errAusencias.message}
        </p>
      </div>
    )
  }

  const ausencias = (ausenciasRaw ?? []) as Ausencia[]

  // Lançamentos de folha
  const { data: lancamentosRaw, error: errLancamentos } = await supabase
    .from('lancamentos_folha')
    .select('*, colaborador:colaboradores(id, nome, cargo)')
    .order('competencia', { ascending: false })

  if (errLancamentos) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 py-10 text-center">
        <p className="text-sm text-destructive">
          Erro ao carregar folha: {errLancamentos.message}
        </p>
      </div>
    )
  }

  const lancamentos = (lancamentosRaw ?? []) as LancamentoFolha[]

  // Colaboradores ativos para selects nos forms
  const colaboradoresAtivos = ativos.map((c) => ({ id: c.id, nome: c.nome }))

  return (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Headcount ativo"
          value={String(ativos.length)}
          icon={Users}
        />
        <KpiCard
          label="Custo estimado de folha"
          value={brl(custoFolhaMes)}
          icon={DollarSign}
        />
        <KpiCard
          label="Ausências registradas"
          value={String(ausencias.length)}
          icon={CalendarMinus}
        />
      </div>

      {/* Colaboradores */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Colaboradores</h3>
          <div className="flex items-center gap-2">
            <AusenciaForm
              colaboradores={colaboradoresAtivos}
              trigger={
                <Button variant="outline" size="sm">
                  <CalendarMinus className="size-4" />
                  Registrar Ausência
                </Button>
              }
            />
            <ColaboradorForm
              trigger={
                <Button size="sm">
                  <Plus className="size-4" />
                  Novo Colaborador
                </Button>
              }
            />
          </div>
        </div>

        <ColaboradoresTable colaboradores={colaboradores} />
      </section>

      {/* Folha de Pagamento */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Folha de Pagamento</h3>
          <LancamentoFormDialog
            colaboradores={colaboradoresAtivos}
            trigger={
              <Button variant="outline" size="sm">
                <Plus className="size-4" />
                Novo Lançamento
              </Button>
            }
          />
        </div>

        <FolhaSimples lancamentos={lancamentos} colaboradores={colaboradoresAtivos} />
      </section>

      {/* TODO(integração): gerar contas a pagar a partir da folha → módulo Financeiro */}
      {/* TODO(integração): consumir módulo de Comissões para vendedores colaboradores */}
      {/* TODO(integração): ponto eletrônico */}
      {/* TODO(integração): avaliação de desempenho */}
    </>
  )
}

// ============================================================================
// Skeleton de carregamento
// ============================================================================
function RhSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-8 w-48" />
      <div className="rounded-xl border border-border bg-card p-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border px-2 py-3 last:border-0"
          >
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// Page — server component, checa auth admin
// ============================================================================
export default async function RhPage() {
  // Verifica auth: apenas admin. Redireciona para /dashboard se role != admin.
  // getAuthAdmin() já faz redirect se não for admin.
  await getAuthAdmin()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground font-[family-name:var(--font-heading)]">
            Recursos Humanos
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie colaboradores, ausências e folha de pagamento.
          </p>
        </div>
      </div>

      <Suspense fallback={<RhSkeleton />}>
        <RhContent />
      </Suspense>
    </div>
  )
}
