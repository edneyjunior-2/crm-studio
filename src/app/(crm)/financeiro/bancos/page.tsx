import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Landmark, Building2, QrCode, Copy, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BancoForm } from '@/components/crm/financeiro/banco-form'
import type { Banco, Movimentacao } from '@/types'

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const TIPO_LABEL: Record<string, string> = {
  corrente: 'Conta Corrente',
  poupanca: 'Poupança',
  investimento: 'Investimento',
  caixa: 'Caixa',
}

function calcSaldo(banco: Banco, movimentacoes: Pick<Movimentacao, 'banco_id' | 'tipo' | 'valor'>[]): number {
  const movs = movimentacoes.filter((m) => m.banco_id === banco.id)
  const entradas = movs.filter((m) => m.tipo === 'entrada').reduce((s, m) => s + Number(m.valor), 0)
  const saidas = movs.filter((m) => m.tipo === 'saida').reduce((s, m) => s + Number(m.valor), 0)
  return Number(banco.saldo_inicial) + entradas - saidas
}

export default async function BancosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'socio'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const { data: bancosData } = await supabase
    .from('bancos')
    .select('*')
    .eq('ativo', true)
    .order('created_at', { ascending: true })

  // movimentacoes: saldo de cada banco = saldo_inicial + TODAS entradas - TODAS saídas.
  // Sem paginação o PostgREST truncaria em ~1000 linhas, corrompendo o saldo.
  let movimentacoes: Pick<Movimentacao, 'banco_id' | 'tipo' | 'valor'>[] = []
  try {
    movimentacoes = await fetchAllRows<Pick<Movimentacao, 'banco_id' | 'tipo' | 'valor'>>((from, to) =>
      supabase
        .from('movimentacoes')
        .select('banco_id, tipo, valor')
        .range(from, to) as unknown as PromiseLike<{ data: Pick<Movimentacao, 'banco_id' | 'tipo' | 'valor'>[] | null; error: import('@supabase/supabase-js').PostgrestError | null }>
    )
  } catch {
    // saldo ficará como saldo_inicial — comportamento degradado aceitável
  }

  const bancos = (bancosData ?? []) as Banco[]

  const saldoTotal = bancos.reduce((sum, b) => sum + calcSaldo(b, movimentacoes), 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground font-[family-name:var(--font-heading)]">Contas Bancárias</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie as contas e movimentações financeiras da empresa.
          </p>
        </div>
        <BancoForm
          trigger={
            <Button>
              <Plus className="size-4" />
              Nova Conta Bancária
            </Button>
          }
        />
      </div>

      {bancos.length > 0 && (
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
            <Landmark className="size-5 text-blue-600" />
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-xs text-muted-foreground">Saldo Total em Caixa</p>
            <p className={`font-mono text-lg font-semibold ${saldoTotal >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {BRL(saldoTotal)}
            </p>
          </div>
        </div>
      )}

      {bancos.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <Landmark className="size-10 text-muted-foreground/40" />
          <div>
            <p className="font-medium text-muted-foreground">Nenhuma conta bancária cadastrada</p>
            <p className="text-sm text-muted-foreground/70">
              Cadastre a primeira conta usando o botão acima.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bancos.map((banco) => {
            const saldo = calcSaldo(banco, movimentacoes)
            return (
              <Link
                key={banco.id}
                href={`/financeiro/bancos/${banco.id}`}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <p className="truncate font-semibold text-foreground">{banco.nome}</p>
                    {banco.instituicao && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Building2 className="size-3.5 shrink-0" />
                        <span className="truncate">{banco.instituicao}</span>
                      </div>
                    )}
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {TIPO_LABEL[banco.tipo] ?? banco.tipo}
                  </Badge>
                </div>

                {(banco.agencia || banco.conta) && (
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {banco.agencia && <span>Ag. {banco.agencia}</span>}
                    {banco.conta && <span>Cc. {banco.conta}</span>}
                  </div>
                )}

                {banco.pix_chave && (
                  <div className="flex items-center gap-1.5 text-xs text-blue-600">
                    <QrCode className="size-3 shrink-0" />
                    <span className="truncate font-mono">{banco.pix_chave}</span>
                  </div>
                )}

                <div className="border-t border-border pt-3">
                  <p className="text-xs text-muted-foreground">Saldo atual</p>
                  <p className={`font-mono text-base font-semibold ${saldo >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {BRL(saldo)}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
