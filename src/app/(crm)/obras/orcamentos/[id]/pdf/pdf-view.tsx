'use client'

import { Printer } from 'lucide-react'
import { OrcamentoDocumento, type OrcamentoDoc, type OrcamentoDocItem, type OrcamentoDocEmpresa } from './orcamento-documento'

export function OrcamentoPdfView({ orcamento, itens, empresa, usuarioNome }: {
  orcamento: OrcamentoDoc; itens: OrcamentoDocItem[]; empresa: OrcamentoDocEmpresa | null; usuarioNome?: string | null
}) {
  return (
    <div className="mx-auto max-w-4xl">
      {/* Barra de ações (não imprime) */}
      <div className="no-print flex justify-end p-4">
        <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
          <Printer className="size-4" /> Imprimir / Salvar PDF
        </button>
      </div>
      <OrcamentoDocumento orcamento={orcamento} itens={itens} empresa={empresa} usuarioNome={usuarioNome} />
    </div>
  )
}
