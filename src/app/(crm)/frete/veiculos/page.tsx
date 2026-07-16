import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Truck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

interface PageProps {
  searchParams: Promise<{ status?: string }>
}

const TIPO_LABEL: Record<string, string> = {
  toco:     'Toco',
  truck:    'Truck',
  carreta:  'Carreta',
  bitrem:   'Bitrem',
  rodotrem: 'Rodotrem',
  outro:    'Outro',
}

export default async function VeiculosPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { status } = await searchParams
  const filtroAtivo = status === 'inativos' ? false : true

  const { data: veiculos, error } = await supabase
    .from('frete_veiculos')
    .select('id, placa, tipo, eixos, rntrc, ativo')
    .eq('ativo', filtroAtivo)
    .order('placa', { ascending: true })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/frete" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Frete
          </Link>
          <span className="text-sm text-muted-foreground">/</span>
          <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight text-foreground">
            Veículos
          </h2>
        </div>
        <Link
          href="/frete/veiculos/novo"
          className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
        >
          <Plus className="size-4" />
          Novo veículo
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
            href={key === 'ativos' ? '/frete/veiculos' : `/frete/veiculos?status=${key}`}
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
          Erro ao carregar veículos: {error.message}
        </div>
      )}

      {(veiculos ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border py-20 text-center">
          <Truck className="size-10 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-medium text-foreground">Nenhum veículo cadastrado</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {filtroAtivo ? 'Cadastre o primeiro veículo da frota.' : 'Nenhum veículo inativo.'}
            </p>
          </div>
          {filtroAtivo && (
            <Link
              href="/frete/veiculos/novo"
              className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background"
            >
              <Plus className="size-4" />
              Cadastrar veículo
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Placa</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="hidden px-4 py-3 text-left sm:table-cell">Eixos</th>
                <th className="hidden px-4 py-3 text-left md:table-cell">RNTRC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(veiculos ?? []).map((v) => (
                <tr key={v.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link href={`/frete/veiculos/${v.id}`} className="font-medium text-foreground hover:underline">
                      {v.placa}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{TIPO_LABEL[v.tipo as string] ?? v.tipo}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{v.eixos ?? '—'}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{v.rntrc ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
