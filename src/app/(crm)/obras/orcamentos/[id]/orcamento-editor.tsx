'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Search, Trash2, Printer, Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  buscarCatalogo, adicionarItem, atualizarItem, removerItem, atualizarOrcamento, excluirOrcamento,
  type CatalogoResultado,
} from '../actions'

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

interface Item {
  id: string; etapa: string | null; categoria: string | null; codigo_sinapi: string | null
  descricao: string; unidade: string | null; quantidade: number; custo_unitario: number; subtotal: number
}
interface Orcamento {
  id: string; titulo: string; modelo: string; uf: string; fonte: string
  data_ref_sinapi: string | null; desoneracao: boolean; bdi_percentual: number
  total: number; status: string; observacoes: string | null; cliente_id: string | null
}

export function OrcamentoEditor({ orcamento, itens: itensIniciais, clientes }: {
  orcamento: Orcamento
  itens: Item[]
  clientes: { id: string; razao_social: string }[]
}) {
  const [orc, setOrc] = useState(orcamento)
  const [itens, setItens] = useState(itensIniciais)
  const [etapaAtual, setEtapaAtual] = useState('')
  const [termo, setTermo] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<'' | 'composicao' | 'insumo'>('')
  const [resultados, setResultados] = useState<CatalogoResultado[]>([])
  const [buscando, setBuscando] = useState(false)
  const [, start] = useTransition()

  const mesRef = orc.data_ref_sinapi ? orc.data_ref_sinapi.slice(0, 7) : ''

  function salvarCampo(campos: Partial<Orcamento>) {
    setOrc((o) => ({ ...o, ...campos }))
    start(async () => {
      const res = await atualizarOrcamento(orc.id, campos as never)
      if (res.error) toast.error(res.error)
    })
  }

  async function buscar() {
    if (termo.trim().length < 2) { toast.error('Digite ao menos 2 caracteres.'); return }
    if (!mesRef) { toast.error('Defina o mês SINAPI no cabeçalho.'); return }
    setBuscando(true)
    try {
      const r = await buscarCatalogo(termo, {
        uf: orc.uf, data_ref: `${mesRef}-01`, fonte: orc.fonte,
        desoneracao: orc.desoneracao, tipo: tipoFiltro || undefined,
      })
      setResultados(r)
      if (r.length === 0) toast.message('Nada encontrado. O catálogo desta UF/mês foi importado?')
    } finally {
      setBuscando(false)
    }
  }

  function adicionar(r: CatalogoResultado) {
    const categoria = r.tipo === 'composicao' ? 'composicao' : 'material'
    const novo: Item = {
      id: `tmp-${Date.now()}`, etapa: etapaAtual.trim() || 'Geral', categoria,
      codigo_sinapi: r.codigo, descricao: r.descricao, unidade: r.unidade,
      quantidade: 1, custo_unitario: r.custo ?? 0, subtotal: r.custo ?? 0,
    }
    setItens((prev) => [...prev, novo])
    start(async () => {
      const res = await adicionarItem(orc.id, {
        etapa: novo.etapa!, categoria, codigo_sinapi: r.codigo, descricao: r.descricao,
        unidade: r.unidade, quantidade: 1, custo_unitario: r.custo ?? 0,
      })
      if (res.error) toast.error(res.error)
    })
  }

  function mudarQtd(item: Item, q: number) {
    const subtotal = Math.round(q * item.custo_unitario * 100) / 100
    setItens((prev) => prev.map((i) => i.id === item.id ? { ...i, quantidade: q, subtotal } : i))
    start(async () => { await atualizarItem(item.id, orc.id, { quantidade: q }) })
  }

  function remover(item: Item) {
    setItens((prev) => prev.filter((i) => i.id !== item.id))
    start(async () => { await removerItem(item.id, orc.id) })
  }

  // Agrupa por etapa
  const grupos = new Map<string, Item[]>()
  for (const i of itens) {
    const e = i.etapa || 'Geral'
    grupos.set(e, [...(grupos.get(e) ?? []), i])
  }
  const custoDireto = itens.reduce((s, i) => s + Number(i.subtotal ?? 0), 0)
  const total = Math.round(custoDireto * (1 + Number(orc.bdi_percentual) / 100) * 100) / 100

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <input value={orc.titulo} onChange={(e) => setOrc((o) => ({ ...o, titulo: e.target.value }))}
            onBlur={(e) => salvarCampo({ titulo: e.target.value })}
            className="w-full rounded-lg border border-transparent bg-transparent px-1 text-xl font-semibold hover:border-border focus:border-border" />
          <p className="px-1 text-sm text-muted-foreground">Orçamento · {orc.fonte} {orc.uf}{mesRef ? ` · ${mesRef}` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/obras/orcamentos/${orc.id}/pdf`} target="_blank"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
            <Printer className="size-4" /> PDF
          </Link>
          <button type="button"
            onClick={() => salvarCampo({ status: orc.status === 'finalizado' ? 'rascunho' : 'finalizado' })}
            className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background hover:bg-foreground/90">
            {orc.status === 'finalizado' ? 'Reabrir' : 'Finalizar'}
          </button>
        </div>
      </div>

      {/* Configurações */}
      <div className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Modelo</span>
          <select value={orc.modelo} onChange={(e) => salvarCampo({ modelo: e.target.value })}
            className="rounded-lg border border-border bg-background px-3 py-2">
            <option value="mao_obra_material">Mão de obra + material</option>
            <option value="mao_obra">Só mão de obra</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Mês SINAPI</span>
          <input type="month" value={mesRef} onChange={(e) => salvarCampo({ data_ref_sinapi: e.target.value as never })}
            className="rounded-lg border border-border bg-background px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">BDI (%)</span>
          <input type="number" step="0.01" value={orc.bdi_percentual}
            onChange={(e) => setOrc((o) => ({ ...o, bdi_percentual: Number(e.target.value) }))}
            onBlur={(e) => salvarCampo({ bdi_percentual: Number(e.target.value) })}
            className="rounded-lg border border-border bg-background px-3 py-2" />
        </label>
        <label className="flex items-center gap-2 self-end text-sm">
          <input type="checkbox" checked={orc.desoneracao} onChange={(e) => salvarCampo({ desoneracao: e.target.checked })} />
          <span className="font-medium">Com desoneração</span>
        </label>
      </div>

      {/* Busca no catálogo */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-2 text-sm font-medium">Adicionar item do catálogo {orc.fonte}</p>
        <div className="flex flex-wrap items-center gap-2">
          <input value={etapaAtual} onChange={(e) => setEtapaAtual(e.target.value)} placeholder="Etapa (ex.: Fundação)"
            className="w-40 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value as never)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="">Todos</option>
            <option value="composicao">Composições</option>
            <option value="insumo">Insumos</option>
          </select>
          <div className="flex flex-1 items-center gap-2">
            <input value={termo} onChange={(e) => setTermo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && buscar()}
              placeholder="Buscar por descrição ou código…" className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <button type="button" onClick={buscar} disabled={buscando}
              className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background hover:bg-foreground/90">
              {buscando ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Buscar
            </button>
          </div>
        </div>
        {resultados.length > 0 && (
          <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-border">
            {resultados.map((r) => (
              <button key={`${r.tipo}-${r.codigo}`} type="button" onClick={() => adicionar(r)}
                className="flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-muted/50">
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{r.codigo}</span>
                <span className="min-w-0 flex-1 truncate">{r.descricao}</span>
                <span className="text-xs text-muted-foreground">{r.unidade}</span>
                <span className="w-24 text-right font-medium tabular-nums">{r.custo != null ? BRL.format(r.custo) : '—'}</span>
                <Plus className="size-4 text-primary" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Itens por etapa */}
      <div className="space-y-4">
        {[...grupos.entries()].map(([etapa, lista]) => {
          const sub = lista.reduce((s, i) => s + Number(i.subtotal ?? 0), 0)
          return (
            <div key={etapa} className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between bg-muted/40 px-4 py-2">
                <h3 className="text-sm font-semibold">{etapa}</h3>
                <span className="text-sm font-medium tabular-nums">{BRL.format(sub)}</span>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  {lista.map((i) => (
                    <tr key={i.id}>
                      <td className="px-4 py-2">
                        <p className="truncate">{i.descricao}</p>
                        <p className="text-[11px] text-muted-foreground">{i.codigo_sinapi} · {i.unidade}</p>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <input type="number" step="0.01" defaultValue={i.quantidade}
                          onBlur={(e) => mudarQtd(i, Number(e.target.value))}
                          className="w-20 rounded border border-border bg-background px-2 py-1 text-right text-sm" />
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{BRL.format(i.custo_unitario)}</td>
                      <td className="px-2 py-2 text-right font-medium tabular-nums">{BRL.format(i.subtotal)}</td>
                      <td className="px-2 py-2 text-right">
                        <button type="button" onClick={() => remover(i)} className="rounded p-1 text-destructive hover:bg-destructive/10"><Trash2 className="size-3.5" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })}
        {itens.length === 0 && (
          <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            Nenhum item. Busque no catálogo {orc.fonte} acima e clique para adicionar.
          </p>
        )}
      </div>

      {/* Totais */}
      <div className="flex flex-col items-end gap-1 rounded-xl border border-border bg-card p-4 text-sm">
        <div className="flex w-64 justify-between"><span className="text-muted-foreground">Custo direto</span><span className="tabular-nums">{BRL.format(custoDireto)}</span></div>
        <div className="flex w-64 justify-between"><span className="text-muted-foreground">BDI ({orc.bdi_percentual}%)</span><span className="tabular-nums">{BRL.format(total - custoDireto)}</span></div>
        <div className="flex w-64 justify-between border-t border-border pt-1 text-base font-semibold"><span>Total</span><span className="tabular-nums">{BRL.format(total)}</span></div>
      </div>

      <div className="flex justify-between">
        <button type="button"
          onClick={() => { if (confirm('Excluir este orçamento?')) start(async () => { await excluirOrcamento(orc.id) }) }}
          className="text-sm text-destructive hover:underline">Excluir orçamento</button>
      </div>
    </div>
  )
}
