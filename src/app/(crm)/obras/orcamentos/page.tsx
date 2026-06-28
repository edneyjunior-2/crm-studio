import Link from 'next/link'
import { FileText, Plus, HardHat } from 'lucide-react'
import { getAuthUser } from '@/lib/auth'
import { NovoOrcamentoButton } from './novo-orcamento'

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const MODELO_LABEL: Record<string, string> = {
  mao_obra: 'Mão de obra',
  mao_obra_material: 'Mão de obra + material',
}

export default async function OrcamentosPage() {
  const { supabase } = await getAuthUser()

  const [{ data: orcamentos }, { data: obras }] = await Promise.all([
    supabase
      .from('orcamentos')
      .select('id, titulo, modelo, total, status, created_at, obra:obras(nome), cliente:clientes(razao_social)')
      .order('created_at', { ascending: false }),
    supabase.from('obras').select('id, nome').order('nome'),
  ])

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
            <FileText className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Orçamentos</h1>
            <p className="text-sm text-muted-foreground">Orçamentos de obra com base SINAPI.</p>
          </div>
        </div>
        <NovoOrcamentoButton obras={obras ?? []} />
      </div>

      {(orcamentos ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <HardHat className="mb-3 size-10 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">Nenhum orçamento ainda</p>
          <p className="mt-1 text-sm text-muted-foreground/70">Crie o primeiro orçamento de obra.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Título</th>
                <th className="hidden px-4 py-3 text-left md:table-cell">Obra / Cliente</th>
                <th className="hidden px-4 py-3 text-left sm:table-cell">Modelo</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(orcamentos ?? []).map((o) => {
                const obra = (o.obra as unknown as { nome: string } | null)?.nome
                const cliente = (o.cliente as unknown as { razao_social: string } | null)?.razao_social
                return (
                  <tr key={o.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link href={`/obras/orcamentos/${o.id}`} className="font-medium text-foreground hover:underline">
                        {o.titulo}
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{obra ?? cliente ?? '—'}</td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{MODELO_LABEL[o.modelo] ?? o.modelo}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{BRL.format(Number(o.total ?? 0))}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${o.status === 'finalizado' ? 'bg-green-500/10 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                        {o.status === 'finalizado' ? 'Finalizado' : 'Rascunho'}
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
