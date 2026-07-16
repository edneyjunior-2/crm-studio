import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Calculator } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

const STATUS_LABEL: Record<string, string> = {
  rascunho:  'Rascunho',
  enviada:   'Enviada',
  aprovada:  'Aprovada',
  em_viagem: 'Em viagem',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

const STATUS_CLASS: Record<string, string> = {
  rascunho:  'bg-muted text-muted-foreground',
  enviada:   'bg-blue-500/10 text-blue-600',
  aprovada:  'bg-emerald-500/10 text-emerald-700',
  em_viagem: 'bg-amber-500/10 text-amber-700',
  concluida: 'bg-green-500/10 text-green-700',
  cancelada: 'bg-red-500/10 text-red-600',
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export default async function CotacoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: cotacoes, error } = await supabase
    .from('frete_cotacoes')
    .select('id, origem, destino, tabela_antt, status, valor_negociado, valor_piso_antt, created_at, clientes(razao_social)')
    .order('created_at', { ascending: false })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/frete" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Frete
          </Link>
          <span className="text-sm text-muted-foreground">/</span>
          <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight text-foreground">
            Cotações
          </h2>
        </div>
        <Link
          href="/frete/cotacoes/nova"
          className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
        >
          <Plus className="size-4" />
          Nova cotação
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Erro ao carregar cotações: {error.message}
        </div>
      )}

      {(cotacoes ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border py-20 text-center">
          <Calculator className="size-10 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-medium text-foreground">Nenhuma cotação cadastrada</p>
            <p className="mt-1 text-sm text-muted-foreground">Crie a primeira cotação de frete com cálculo de piso ANTT.</p>
          </div>
          <Link
            href="/frete/cotacoes/nova"
            className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background"
          >
            <Plus className="size-4" />
            Nova cotação
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Rota</th>
                <th className="hidden px-4 py-3 text-left md:table-cell">Cliente</th>
                <th className="hidden px-4 py-3 text-left sm:table-cell">Tabela ANTT</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(cotacoes ?? []).map((c) => {
                const clienteRaw  = c.clientes as unknown
                const clienteNome = (clienteRaw as { razao_social?: string } | null)?.razao_social ?? null
                const valor       = (c.valor_negociado as number | null) ?? (c.valor_piso_antt as number | null)
                const abaixoPiso  = c.valor_negociado != null && c.valor_piso_antt != null && (c.valor_negociado as number) < (c.valor_piso_antt as number)
                return (
                  <tr key={c.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link href={`/frete/cotacoes/${c.id}`} className="font-medium text-foreground hover:underline">
                        {c.origem} → {c.destino}
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{clienteNome ?? '—'}</td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{c.tabela_antt}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {valor != null ? BRL.format(valor) : '—'}
                      {abaixoPiso && <span className="ml-1.5 text-xs font-normal text-amber-600">abaixo do piso</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[c.status] ?? 'bg-muted text-muted-foreground'}`}>
                        {STATUS_LABEL[c.status] ?? c.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
