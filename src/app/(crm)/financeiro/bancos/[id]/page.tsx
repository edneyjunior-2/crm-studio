import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Landmark, TrendingUp, TrendingDown, Pencil, QrCode } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BancoForm } from '@/components/crm/financeiro/banco-form'
import { MovimentacaoForm } from '@/components/crm/financeiro/movimentacao-form'
import { MovimentacoesLista } from '@/components/crm/financeiro/movimentacoes-lista'
import { PixCopiavel } from '@/components/crm/financeiro/pix-copiavel'
import type { Banco, Movimentacao } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
}

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const TIPO_LABEL: Record<string, string> = {
  corrente: 'Conta Corrente',
  poupanca: 'Poupança',
  investimento: 'Investimento',
  caixa: 'Caixa',
}

export default async function BancoDetailPage({ params }: PageProps) {
  const { id } = await params

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

  const [{ data: bancoData, error: bancoError }, { data: movsData }] = await Promise.all([
    supabase.from('bancos').select('*').eq('id', id).single(),
    supabase
      .from('movimentacoes')
      .select('*')
      .eq('banco_id', id)
      .order('data', { ascending: false }),
  ])

  if (bancoError || !bancoData) notFound()

  const banco = bancoData as Banco
  const movimentacoes = (movsData ?? []) as Movimentacao[]

  const entradas = movimentacoes
    .filter((m) => m.tipo === 'entrada')
    .reduce((s, m) => s + Number(m.valor), 0)
  const saidas = movimentacoes
    .filter((m) => m.tipo === 'saida')
    .reduce((s, m) => s + Number(m.valor), 0)
  const saldoAtual = Number(banco.saldo_inicial) + entradas - saidas

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" nativeButton={false} render={<Link href="/financeiro/bancos" />}>
            <ArrowLeft className="size-4" />
            <span className="sr-only">Voltar</span>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight text-foreground font-[family-name:var(--font-heading)]">{banco.nome}</h2>
              <Badge variant="secondary" className="text-xs">
                {TIPO_LABEL[banco.tipo] ?? banco.tipo}
              </Badge>
            </div>
            {banco.instituicao && (
              <span className="text-sm text-muted-foreground">{banco.instituicao}</span>
            )}
            {(banco.agencia || banco.conta) && (
              <span className="text-xs text-muted-foreground">
                {banco.agencia ? `Ag. ${banco.agencia}` : ''}
                {banco.agencia && banco.conta ? ' · ' : ''}
                {banco.conta ? `Cc. ${banco.conta}` : ''}
              </span>
            )}
            {banco.pix_chave && (
              <PixCopiavel tipo={banco.pix_tipo} chave={banco.pix_chave} />
            )}
          </div>
        </div>
        <BancoForm
          banco={banco}
          trigger={
            <Button variant="outline" size="sm">
              <Pencil className="size-4" />
              Editar
            </Button>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
            <Landmark className="size-4 text-blue-600" />
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-xs text-muted-foreground">Saldo Atual</p>
            <p className={`font-mono text-base font-semibold ${saldoAtual >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {BRL(saldoAtual)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
            <TrendingUp className="size-4 text-emerald-600" />
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-xs text-muted-foreground">Total Entradas</p>
            <p className="font-mono text-base font-semibold text-emerald-600">{BRL(entradas)}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
            <TrendingDown className="size-4 text-red-600" />
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-xs text-muted-foreground">Total Saídas</p>
            <p className="font-mono text-base font-semibold text-red-600">{BRL(saidas)}</p>
          </div>
        </div>
      </div>

      {(banco.agencia || banco.conta) && (
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-3 text-sm text-muted-foreground">
          {banco.agencia && <span>Agência: <strong className="text-foreground">{banco.agencia}</strong></span>}
          {banco.conta && <span>Conta: <strong className="text-foreground">{banco.conta}</strong></span>}
          <span>Saldo inicial: <strong className="text-foreground font-mono">{BRL(Number(banco.saldo_inicial))}</strong></span>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground">Movimentações</h3>
          <MovimentacaoForm
            bancoId={id}
            trigger={
              <Button size="sm">
                <Plus className="size-4" />
                Nova Movimentação
              </Button>
            }
          />
        </div>

        <MovimentacoesLista movimentacoes={movimentacoes} bancoId={id} />
      </div>
    </div>
  )
}
