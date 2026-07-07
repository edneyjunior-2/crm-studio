'use client'

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const PERCENTUAL = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

export interface SolucaoDocCliente {
  cliente_id: string
  razao_social: string
  contato_nome: string | null
  contato_email: string | null
  contato_telefone: string | null
  numero_negocios: number
  valor_total: number
}
export interface SolucaoDoc {
  nome: string
  empresa_representada: string | null
  comissao_percentual: number | null
}
export interface SolucaoDocEmpresa {
  nome: string
  razao_social: string | null
  nome_fantasia: string | null
  cnpj: string | null
}

function dataHoje(): string {
  const hoje = new Date()
  const dia = String(hoje.getDate()).padStart(2, '0')
  const mes = String(hoje.getMonth() + 1).padStart(2, '0')
  return `${dia}/${mes}/${hoje.getFullYear()}`
}

/**
 * Corpo do extrato de clientes de uma solução, reutilizável entre a rota /pdf e
 * eventuais pré-visualizações futuras. Mantém a classe `doc-print` e o <style> de
 * print: ao chamar window.print() o navegador imprime apenas este container (o
 * resto da página fica com visibility:hidden) — mesmo mecanismo do orçamento.
 */
export function SolucaoDocumento({
  solucao,
  clientes,
  empresa,
  usuarioNome,
}: {
  solucao: SolucaoDoc
  clientes: SolucaoDocCliente[]
  empresa: SolucaoDocEmpresa | null
  usuarioNome?: string | null
}) {
  const totalNegocios = clientes.reduce((s, c) => s + c.numero_negocios, 0)
  const totalValor = clientes.reduce((s, c) => s + c.valor_total, 0)
  const empresaNome = empresa?.nome_fantasia || empresa?.razao_social || empresa?.nome || 'Empresa'
  const comissaoFormatada =
    solucao.comissao_percentual != null ? `${PERCENTUAL.format(solucao.comissao_percentual)}%` : '—'
  const hoje = dataHoje()

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
          <p className="text-base font-bold tracking-tight">EXTRATO DE CLIENTES</p>
          <p className="text-xs text-zinc-500">Solução · {hoje}</p>
        </div>
      </div>

      {/* Identificação */}
      <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
        <div>
          <span className="text-zinc-500">Solução: </span>
          <span className="font-medium">{solucao.nome}</span>
        </div>
        {solucao.empresa_representada && (
          <div>
            <span className="text-zinc-500">Empresa representada: </span>
            {solucao.empresa_representada}
          </div>
        )}
        <div>
          <span className="text-zinc-500">Comissão: </span>
          {comissaoFormatada}
        </div>
        <div>
          <span className="text-zinc-500">Total de clientes: </span>
          {clientes.length}
        </div>
      </div>

      {/* Tabela de clientes */}
      <div className="mt-6">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-zinc-300 text-zinc-500">
              <th className="py-1 text-left font-medium">Cliente</th>
              <th className="py-1 text-left font-medium">Contato</th>
              <th className="py-1 text-right font-medium">Negócios</th>
              <th className="py-1 text-right font-medium">Valor total</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => {
              const contato = [c.contato_nome, c.contato_email, c.contato_telefone].filter(Boolean).join(' · ')
              return (
                <tr key={c.cliente_id} className="border-b border-zinc-100">
                  <td className="py-1 pr-2 font-medium">{c.razao_social}</td>
                  <td className="py-1 pr-2 text-zinc-500">{contato || '—'}</td>
                  <td className="py-1 text-right tabular-nums">{c.numero_negocios}</td>
                  <td className="py-1 text-right font-medium tabular-nums">{BRL.format(c.valor_total)}</td>
                </tr>
              )
            })}
            {clientes.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-zinc-400">
                  Nenhum cliente vinculado a esta solução.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Totais */}
      <div className="mt-6 flex justify-end">
        <div className="w-72 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-500">Total de negócios</span>
            <span className="tabular-nums">{totalNegocios}</span>
          </div>
          <div className="flex justify-between border-t-2 border-zinc-900 pt-1 text-base font-bold">
            <span>VALOR TOTAL</span>
            <span className="tabular-nums">{BRL.format(totalValor)}</span>
          </div>
        </div>
      </div>

      <p className="mt-8 text-center text-[10px] text-zinc-400">
        {usuarioNome ? `Gerado por ${usuarioNome} em ${hoje}` : `Gerado em ${hoje}`} · CRM Studio.
      </p>
    </div>
  )
}
