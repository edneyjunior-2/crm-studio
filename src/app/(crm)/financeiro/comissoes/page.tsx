import { redirect } from 'next/navigation'
import { TrendingUp, Clock, CheckCircle2, Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { Badge } from '@/components/ui/badge'
import type { ComissaoComercial } from '@/types'

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

function formatDate(d: string) {
  const [y, m, day] = d.split('-')
  return new Date(+y, +m - 1, +day).toLocaleDateString('pt-BR')
}

const statusConfig = {
  previsto: { label: 'Previsto', variant: 'secondary' as const, icon: Clock },
  pago: { label: 'Pago', variant: 'default' as const, icon: CheckCircle2 },
  cancelado: { label: 'Cancelado', variant: 'outline' as const, icon: null },
}

export default async function MinhasComissoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  // Comercial e parceiro acessam esta página diretamente — os dois veem só as
  // próprias comissões (RLS filtra por comercial_id). admin/socio são
  // redirecionados para a visão completa em /financeiro.
  if (!profile) redirect('/login')
  if (profile.role !== 'comercial' && profile.role !== 'parceiro') redirect('/financeiro')

  // totalPrevisto/totalPago somam TODAS as linhas do comercial — um cap
  // silencioso do PostgREST (~1000 linhas) subestimaria os KPIs, por isso
  // fetchAllRows em vez de um .select() cru.
  type ComissaoComNegocio = ComissaoComercial & { negocios: { titulo: string } | null }
  let comissoes: ComissaoComNegocio[]
  try {
    comissoes = await fetchAllRows<ComissaoComNegocio>((from, to) =>
      supabase
        .from('comissoes_comercial')
        .select('*, negocios(titulo)')
        .eq('comercial_id', user.id)
        .order('data_previsao', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to)
    )
  } catch {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground font-[family-name:var(--font-heading)]">Minhas Comissões</h2>
        </div>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
          Erro ao carregar comissões. Tente novamente mais tarde.
        </div>
      </div>
    )
  }

  const lista = comissoes

  const totalPrevisto = lista
    .filter((c) => c.status === 'previsto')
    .reduce((sum, c) => sum + Number(c.valor), 0)

  const totalPago = lista
    .filter((c) => c.status === 'pago')
    .reduce((sum, c) => sum + Number(c.valor), 0)

  const previstas = lista.filter((c) => c.status === 'previsto')
  const historico = lista.filter((c) => c.status !== 'previsto')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Minhas Comissões</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Previsões de pagamento e histórico de comissões recebidas.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
            <Clock className="size-5 text-amber-600" />
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-xs text-muted-foreground">A Receber</p>
            <p className="font-mono text-lg font-semibold text-amber-600">{BRL(totalPrevisto)}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
            <CheckCircle2 className="size-5 text-emerald-600" />
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-xs text-muted-foreground">Total Recebido</p>
            <p className="font-mono text-lg font-semibold text-emerald-600">{BRL(totalPago)}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Wallet className="size-5 text-primary" />
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-xs text-muted-foreground">Total Acumulado</p>
            <p className="font-mono text-lg font-semibold text-primary">{BRL(totalPrevisto + totalPago)}</p>
          </div>
        </div>
      </div>

      {/* Previsões */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">Previsões de Pagamento</h3>
        {previstas.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10">
            <TrendingUp className="mb-2 size-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Nenhuma comissão prevista no momento.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Descrição</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Negócio</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Valor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Previsão</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {previstas.map((c) => {
                  const cfg = statusConfig[c.status]
                  return (
                    <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{c.descricao}</div>
                        {c.observacoes && (
                          <div className="text-xs text-muted-foreground mt-0.5">{c.observacoes}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {c.negocios?.titulo ?? <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-amber-600">
                        {BRL(Number(c.valor))}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(c.data_previsao)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Histórico */}
      {historico.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-foreground">Histórico</h3>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Descrição</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Negócio</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Valor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Pago em</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((c) => {
                  const cfg = statusConfig[c.status]
                  return (
                    <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{c.descricao}</div>
                        {c.observacoes && (
                          <div className="text-xs text-muted-foreground mt-0.5">{c.observacoes}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {c.negocios?.titulo ?? <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-600">
                        {BRL(Number(c.valor))}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {c.data_pagamento ? formatDate(c.data_pagamento) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
