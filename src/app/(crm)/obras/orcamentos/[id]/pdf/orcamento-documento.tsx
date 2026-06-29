'use client'

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export interface OrcamentoDocItem {
  etapa: string | null; codigo_sinapi: string | null; descricao: string; unidade: string | null
  quantidade: number; custo_unitario: number; subtotal: number
}
export interface OrcamentoDoc {
  titulo: string; modelo: string; uf: string; fonte: string; data_ref_sinapi: string | null
  bdi_percentual: number; desoneracao: boolean; observacoes: string | null
  cliente: { razao_social: string; cnpj: string | null } | null
  obra: { nome: string; endereco: string | null } | null
}
export interface OrcamentoDocEmpresa { nome: string; razao_social: string | null; nome_fantasia: string | null; cnpj: string | null }

/**
 * Corpo do documento do orçamento, reutilizável entre a rota /pdf e o modal de pré-visualização.
 * Mantém a classe `doc-print` e o <style> de print: ao chamar window.print() o navegador
 * imprime apenas este container (o resto da página fica com visibility:hidden).
 */
export function OrcamentoDocumento({ orcamento, itens, empresa, usuarioNome }: {
  orcamento: OrcamentoDoc; itens: OrcamentoDocItem[]; empresa: OrcamentoDocEmpresa | null; usuarioNome?: string | null
}) {
  const grupos = new Map<string, OrcamentoDocItem[]>()
  for (const i of itens) { const e = i.etapa || 'Geral'; grupos.set(e, [...(grupos.get(e) ?? []), i]) }
  const custoDireto = itens.reduce((s, i) => s + Number(i.subtotal ?? 0), 0)
  const total = Math.round(custoDireto * (1 + Number(orcamento.bdi_percentual) / 100) * 100) / 100
  const empresaNome = empresa?.nome_fantasia || empresa?.razao_social || empresa?.nome || 'Empresa'
  const mes = orcamento.data_ref_sinapi?.slice(0, 7) ?? '—'

  return (
    <div className="mx-auto max-w-4xl bg-white p-8 text-[13px] text-zinc-800 doc-print">
      <style>{`@media print { body * { visibility: hidden } .doc-print, .doc-print * { visibility: visible } .doc-print { position: absolute; left: 0; top: 0; width: 100% } .no-print { display: none !important } }`}</style>

      {/* Cabeçalho institucional */}
      <div className="flex items-start justify-between border-b-2 border-zinc-900 pb-4">
        <div>
          <h1 className="text-lg font-bold">{empresaNome}</h1>
          {empresa?.cnpj && <p className="text-xs text-zinc-500">CNPJ: {empresa.cnpj}</p>}
        </div>
        <div className="text-right">
          <p className="text-base font-bold tracking-tight">ORÇAMENTO</p>
          <p className="text-xs text-zinc-500">{orcamento.fonte} {orcamento.uf} · ref. {mes}</p>
        </div>
      </div>

      {/* Identificação */}
      <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
        <div><span className="text-zinc-500">Título: </span><span className="font-medium">{orcamento.titulo}</span></div>
        <div><span className="text-zinc-500">Modelo: </span>{orcamento.modelo === 'mao_obra' ? 'Mão de obra' : 'Mão de obra + material'}</div>
        {orcamento.obra && <div><span className="text-zinc-500">Obra: </span>{orcamento.obra.nome}</div>}
        {orcamento.cliente && <div><span className="text-zinc-500">Cliente: </span>{orcamento.cliente.razao_social}</div>}
        <div><span className="text-zinc-500">BDI: </span>{orcamento.bdi_percentual}%</div>
        <div><span className="text-zinc-500">Encargos: </span>{orcamento.desoneracao ? 'com desoneração' : 'sem desoneração'}</div>
      </div>

      {/* Itens por etapa */}
      <div className="mt-6 space-y-4">
        {[...grupos.entries()].map(([etapa, lista]) => {
          const sub = lista.reduce((s, i) => s + Number(i.subtotal ?? 0), 0)
          return (
            <div key={etapa}>
              <div className="flex items-center justify-between bg-zinc-100 px-2 py-1 text-xs font-semibold">
                <span>{etapa}</span><span className="tabular-nums">{BRL.format(sub)}</span>
              </div>
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-zinc-300 text-zinc-500">
                    <th className="py-1 text-left font-medium">Cód</th>
                    <th className="py-1 text-left font-medium">Descrição</th>
                    <th className="py-1 text-center font-medium">Un</th>
                    <th className="py-1 text-right font-medium">Qtd</th>
                    <th className="py-1 text-right font-medium">Custo unit.</th>
                    <th className="py-1 text-right font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((i, idx) => (
                    <tr key={idx} className="border-b border-zinc-100">
                      <td className="py-1 font-mono text-zinc-500">{i.codigo_sinapi}</td>
                      <td className="py-1 pr-2">{i.descricao}</td>
                      <td className="py-1 text-center text-zinc-500">{i.unidade}</td>
                      <td className="py-1 text-right tabular-nums">{Number(i.quantidade).toLocaleString('pt-BR')}</td>
                      <td className="py-1 text-right tabular-nums">{BRL.format(i.custo_unitario)}</td>
                      <td className="py-1 text-right font-medium tabular-nums">{BRL.format(i.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })}
      </div>

      {/* Totais */}
      <div className="mt-6 flex justify-end">
        <div className="w-72 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-zinc-500">Custo direto</span><span className="tabular-nums">{BRL.format(custoDireto)}</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">BDI ({orcamento.bdi_percentual}%)</span><span className="tabular-nums">{BRL.format(total - custoDireto)}</span></div>
          <div className="flex justify-between border-t-2 border-zinc-900 pt-1 text-base font-bold"><span>TOTAL</span><span className="tabular-nums">{BRL.format(total)}</span></div>
        </div>
      </div>

      {orcamento.observacoes && (
        <div className="mt-6 text-xs"><p className="font-semibold">Observações</p><p className="text-zinc-600">{orcamento.observacoes}</p></div>
      )}

      {/* Assinatura */}
      <div className="mt-16 grid grid-cols-2 gap-12 text-center text-xs">
        <div className="border-t border-zinc-400 pt-1 flex flex-col gap-0.5">
          {usuarioNome && <span className="font-medium">{usuarioNome}</span>}
          <span>{empresaNome}</span>
          {empresa?.cnpj && <span className="text-zinc-500">CNPJ: {empresa.cnpj}</span>}
        </div>
        <div className="border-t border-zinc-400 pt-1">Cliente</div>
      </div>

      <p className="mt-8 text-center text-[10px] text-zinc-400">
        Preços de referência {orcamento.fonte} {orcamento.uf} ({mes}). Gerado pelo CRM Studio.
      </p>
    </div>
  )
}
