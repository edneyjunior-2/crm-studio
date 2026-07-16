import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, IdCard } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

interface PageProps {
  searchParams: Promise<{ status?: string }>
}

const VINCULO_LABEL: Record<string, string> = {
  autonomo: 'Autônomo',
  clt:      'CLT',
}

function cnhVencida(validade: string | null): boolean {
  if (!validade) return false
  const [ano, mes, dia] = validade.slice(0, 10).split('-').map(Number)
  const hoje = new Date()
  const dataValidade = new Date(ano, (mes ?? 1) - 1, dia ?? 1)
  return dataValidade.getTime() < new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime()
}

function cnhVencendo(validade: string | null): boolean {
  if (!validade) return false
  const [ano, mes, dia] = validade.slice(0, 10).split('-').map(Number)
  const hoje = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())
  const dataValidade = new Date(ano, (mes ?? 1) - 1, dia ?? 1)
  const diffDias = Math.round((dataValidade.getTime() - hoje.getTime()) / 86400000)
  return diffDias >= 0 && diffDias <= 30
}

export default async function MotoristasPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { status } = await searchParams
  const filtroAtivo = status === 'inativos' ? false : true

  const { data: motoristas, error } = await supabase
    .from('frete_motoristas')
    .select('id, nome, cnh_categoria, cnh_validade, vinculo, ativo')
    .eq('ativo', filtroAtivo)
    .order('nome', { ascending: true })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/frete" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Frete
          </Link>
          <span className="text-sm text-muted-foreground">/</span>
          <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight text-foreground">
            Motoristas
          </h2>
        </div>
        <Link
          href="/frete/motoristas/novo"
          className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
        >
          <Plus className="size-4" />
          Novo motorista
        </Link>
      </div>

      {/* Filtro ativo/inativo */}
      <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit">
        {([
          { key: 'ativos',   label: 'Ativos' },
          { key: 'inativos', label: 'Inativos' },
        ] as const).map(({ key, label }) => (
          <Link
            key={key}
            href={key === 'ativos' ? '/frete/motoristas' : `/frete/motoristas?status=${key}`}
            className={
              (key === 'ativos' ? filtroAtivo : !filtroAtivo)
                ? 'rounded-md bg-background px-4 py-1.5 text-sm font-medium shadow-sm text-foreground'
                : 'px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground'
            }
          >
            {label}
          </Link>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Erro ao carregar motoristas: {error.message}
        </div>
      )}

      {(motoristas ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border py-20 text-center">
          <IdCard className="size-10 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-medium text-foreground">Nenhum motorista cadastrado</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {filtroAtivo ? 'Cadastre o primeiro motorista.' : 'Nenhum motorista inativo.'}
            </p>
          </div>
          {filtroAtivo && (
            <Link
              href="/frete/motoristas/novo"
              className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background"
            >
              <Plus className="size-4" />
              Cadastrar motorista
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="hidden px-4 py-3 text-left sm:table-cell">Categoria CNH</th>
                <th className="px-4 py-3 text-left">Validade CNH</th>
                <th className="hidden px-4 py-3 text-left md:table-cell">Vínculo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(motoristas ?? []).map((m) => {
                const validade = m.cnh_validade as string | null
                const vencida  = cnhVencida(validade)
                const vencendo = !vencida && cnhVencendo(validade)
                return (
                  <tr key={m.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link href={`/frete/motoristas/${m.id}`} className="font-medium text-foreground hover:underline">
                        {m.nome}
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{m.cnh_categoria}</td>
                    <td className="px-4 py-3">
                      <span className={vencida ? 'text-destructive font-medium' : vencendo ? 'text-amber-600 font-medium' : 'text-muted-foreground'}>
                        {validade ? validade.slice(0, 10).split('-').reverse().join('/') : '—'}
                      </span>
                      {(vencida || vencendo) && (
                        <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${vencida ? 'bg-red-500/10 text-red-600' : 'bg-amber-500/10 text-amber-700'}`}>
                          {vencida ? 'Vencida' : 'Vence em breve'}
                        </span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{VINCULO_LABEL[m.vinculo as string] ?? m.vinculo}</td>
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
