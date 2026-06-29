import { getAuthPlatformAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { SinapiImportForm } from './import-form'

export const dynamic = 'force-dynamic'

export default async function SinapiAdminPage() {
  await getAuthPlatformAdmin()
  const db = createAdminClient()

  // Resumo agregado no BANCO (view precos_referencia_resumo). NÃO contar no cliente:
  // o SELECT de linhas cruas é truncado pelo cap de 1000 linhas do PostgREST, o que
  // dava contagem errada ("0 insumos / 1.000 composições").
  const { data: linhas } = await db
    .from('precos_referencia_resumo')
    .select('fonte, uf, data_ref, insumos, composicoes')
    .order('data_ref', { ascending: false })

  const resumo = (linhas ?? []).map((l) => ({
    fonte: l.fonte as string,
    uf: l.uf as string,
    data_ref: l.data_ref as string,
    insumo: Number(l.insumos),
    composicao: Number(l.composicoes),
  }))

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
