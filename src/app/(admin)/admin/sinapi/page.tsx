import { getAuthPlatformAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { SinapiImportForm } from './import-form'

export const dynamic = 'force-dynamic'

export default async function SinapiAdminPage() {
  await getAuthPlatformAdmin()
  const db = createAdminClient()

  // Resumo do que já foi importado (por fonte/uf/mês/tipo)
  const { data: linhas } = await db
    .from('precos_referencia')
    .select('fonte, uf, data_ref, tipo')
    .limit(50000)

  const resumoMap = new Map<string, { fonte: string; uf: string; data_ref: string; insumo: number; composicao: number }>()
  for (const l of linhas ?? []) {
    const k = `${l.fonte}|${l.uf}|${l.data_ref}`
    const r = resumoMap.get(k) ?? { fonte: l.fonte, uf: l.uf, data_ref: l.data_ref, insumo: 0, composicao: 0 }
    if (l.tipo === 'insumo') r.insumo++
    else if (l.tipo === 'composicao') r.composicao++
    resumoMap.set(k, r)
  }
  const resumo = [...resumoMap.values()].sort((a, b) => b.data_ref.localeCompare(a.data_ref))

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <div>
        <h1 className="text-xl font-semibold">Catálogo SINAPI / ORSE</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Importe a planilha mensal de preços (Relatórios Mensais da Caixa, por UF). Os preços ficam
          disponíveis para os orçamentos do módulo Engenharia de todas as empresas.
        </p>
      </div>

      <SinapiImportForm />

      <div>
        <h2 className="mb-3 text-sm font-semibold">Já importado</h2>
        {resumo.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhum catálogo importado ainda.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Fonte</th>
                  <th className="px-4 py-2 text-left">UF</th>
                  <th className="px-4 py-2 text-left">Mês</th>
                  <th className="px-4 py-2 text-right">Insumos</th>
                  <th className="px-4 py-2 text-right">Composições</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {resumo.map((r) => (
                  <tr key={`${r.fonte}-${r.uf}-${r.data_ref}`}>
                    <td className="px-4 py-2">{r.fonte}</td>
                    <td className="px-4 py-2">{r.uf}</td>
                    <td className="px-4 py-2">{r.data_ref.slice(0, 7)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.insumo.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.composicao.toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
