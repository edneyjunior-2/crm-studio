'use client'

import { Printer } from 'lucide-react'
import {
  SolucaoDocumento,
  type SolucaoDoc,
  type SolucaoDocCliente,
  type SolucaoDocEmpresa,
} from './solucao-documento'

export function SolucaoPdfView({
  solucao,
  clientes,
  empresa,
  usuarioNome,
  timbradoUrl,
}: {
  solucao: SolucaoDoc
  clientes: SolucaoDocCliente[]
  empresa: SolucaoDocEmpresa | null
  usuarioNome?: string | null
  timbradoUrl?: string | null
}) {
  return (
    <div className="mx-auto max-w-4xl">
      {/* Barra de ações (não imprime) */}
      <div className="no-print flex justify-end p-4">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
        >
          <Printer className="size-4" /> Imprimir / Salvar PDF
        </button>
      </div>
      <div className="overflow-x-auto">
        <SolucaoDocumento
          solucao={solucao}
          clientes={clientes}
          empresa={empresa}
          usuarioNome={usuarioNome}
          timbradoUrl={timbradoUrl ?? null}
        />
      </div>
    </div>
  )
}
