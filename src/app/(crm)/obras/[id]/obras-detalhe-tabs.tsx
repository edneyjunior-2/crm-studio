'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ListChecks, BarChart3, Plus, Trash2, ChevronDown, ChevronUp,
  Users, Loader2, UserMinus, FileBarChart2,
} from 'lucide-react'
import {
  criarEtapa, atualizarStatusEtapa, excluirEtapa,
  atualizarStatusMedicao, excluirMedicao,
  listarEtapasOrcamento, criarMedicaoBoletim, getBoletimMedicao,
} from '../actions'
import type { EtapaOrcamento, BoletimMedicao } from '../actions'
import { adicionarColaboradorObra, removerColaboradorObra } from './equipe-actions'
import { CurvaSChart } from '@/components/crm/obras/curva-s-chart'
import type { PontoMedicao } from '@/components/crm/obras/curva-s-chart'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Etapa {
  id: string; nome: string; descricao: string | null
  percentual_obra: number | null; valor: number | null
  status: string; data_previsao: string | null; data_conclusao: string | null; ordem: number
}
interface Medicao {
  id: string; numero_medicao: number; descricao: string
  percentual: number | null; valor: number | null
  data_medicao: string | null; status: string; observacoes: string | null
  orcamento_id?: string | null
}
interface Membro { id: string; nome: string }

interface ObraColaborador {
  id: string
  colaborador_id: string
  colaborador_nome: string
  funcao: string | null
  data_inicio: string | null
  ativo: boolean
}

interface ColaboradorDisponivel {
  id: string
  nome: string
  cargo: string | null
}

interface OrcamentoResumido {
  id: string
  titulo: string
  total: number | null
  bdi_percentual: number | null
}

interface Props {
  obraId:      string
  etapas:      Etapa[]
  medicoes:    Medicao[]
  membros:     Membro[]
  podeExcluir: boolean
  equipe:      ObraColaborador[]
  colaboradoresDisponiveis: ColaboradorDisponivel[]
  orcamentos:  OrcamentoResumido[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const brl = (v: number | null | undefined) =>
  v != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : '—'

function fmt(d: string | null) {
  if (!d) return null
  const [y, m, dia] = d.slice(0, 10).split('-')
  return `${dia}/${m}/${y}`
}

const ETAPA_STATUS_LABEL: Record<string, string> = {
  pendente:     'Pendente',
  em_andamento: 'Em andamento',
  concluida:    'Concluída',
}
const ETAPA_STATUS_NEXT: Record<string, string> = {
  pendente:     'em_andamento',
  em_andamento: 'concluida',
  concluida:    'pendente',
}
const ETAPA_STATUS_CLASS: Record<string, string> = {
  pendente:     'bg-muted text-muted-foreground border border-border',
  em_andamento: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  concluida:    'bg-green-500/10 text-green-700 dark:text-green-400',
}

const MEDICAO_STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente', aprovada: 'Aprovada', faturada: 'Faturada',
}
const MEDICAO_STATUS_NEXT: Record<string, string> = {
  pendente: 'aprovada', aprovada: 'faturada', faturada: 'pendente',
}
const MEDICAO_STATUS_CLASS: Record<string, string> = {
  pendente: 'bg-muted text-muted-foreground border border-border',
  aprovada: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  faturada: 'bg-green-500/10 text-green-700 dark:text-green-400',
}

const inp = 'h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-foreground/40'

// ---------------------------------------------------------------------------
// MedicaoBoletimRow — expande uma medição e carrega o boletim
// ---------------------------------------------------------------------------

function MedicaoBoletimRow({
  med, podeExcluir, isPending,
  onStatusChange, onDelete,
}: {
  med: Medicao
  podeExcluir: boolean
  isPending: boolean
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
}) {
  const [expandido, setExpandido] = useState(false)
  const [boletim, setBoletim] = useState<BoletimMedicao | null>(null)
  const [loadingBoletim, setLoadingBoletim] = useState(false)
  const [boletimErro, setBoletimErro] = useState<string | null>(null)

  async function abrirBoletim() {
    if (!expandido && med.orcamento_id) {
      setLoadingBoletim(true)
      setBoletimErro(null)
      const res = await getBoletimMedicao(med.id)
      if (res.error) setBoletimErro(res.error)
      else setBoletim(res.data ?? null)
      setLoadingBoletim(false)
    }
    setExpandido((v) => !v)
  }

  const temBoletim = !!med.orcamento_id

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <span className="shrink-0 w-8 text-center text-xs font-mono font-semibold text-muted-foreground">
          #{med.numero_medicao}
        </span>

        <button
          type="button"
          onClick={() => onStatusChange(med.id, med.status)}
          disabled={isPending}
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-opacity hover:opacity-70 disabled:opacity-50 ${MEDICAO_STATUS_CLASS[med.status] ?? ''}`}
          title="Clique para avançar o status"
        >
          {MEDICAO_STATUS_LABEL[med.status] ?? med.status}
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{med.descricao}</p>
          <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            {med.percentual != null && <span>{med.percentual.toFixed(1)}%</span>}
            {med.valor != null && <span className="font-medium text-foreground">{brl(med.valor)}</span>}
            {med.data_medicao && <span>{fmt(med.data_medicao)}</span>}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {temBoletim && (
            <button
              type="button"
              onClick={abrirBoletim}
              className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Ver boletim físico-financeiro"
            >
              <FileBarChart2 className="size-3.5" />
              {expandido ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </button>
          )}
          {podeExcluir && (
            <button
              type="button"
              onClick={() => onDelete(med.id)}
              disabled={isPending}
              className="text-muted-foreground/50 transition-colors hover:text-destructive disabled:opacity-50"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Boletim expandido */}
      {expandido && temBoletim && (
        <div className="border-t border-border bg-muted/20 px-3 py-3">
          {loadingBoletim && (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Carregando boletim…</span>
            </div>
          )}
          {boletimErro && (
            <p className="text-xs text-destructive">{boletimErro}</p>
          )}
          {boletim && !loadingBoletim && (
            <>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="pb-1.5 text-left font-medium">Etapa</th>
                    <th className="pb-1.5 text-right font-medium">Valor orçado</th>
                    <th className="pb-1.5 text-right font-medium">% exec.</th>
                    <th className="pb-1.5 text-right font-medium">Valor medido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {boletim.etapas.map((et) => (
                    <tr key={et.etapa} className="text-foreground">
                      <td className="py-1.5 pr-3">{et.etapa}</td>
                      <td className="py-1.5 text-right tabular-nums text-muted-foreground">{brl(et.valorOrcado)}</td>
                      <td className="py-1.5 text-right tabular-nums">{et.percentual.toFixed(1)}%</td>
                      <td className="py-1.5 text-right tabular-nums font-medium">{brl(et.valorMedido)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border font-semibold text-foreground">
                    <td className="pt-1.5">Total</td>
                    <td className="pt-1.5 text-right tabular-nums text-muted-foreground">{brl(boletim.totalOrcado)}</td>
                    <td className="pt-1.5 text-right tabular-nums">{boletim.percentualGlobal.toFixed(1)}%</td>
                    <td className="pt-1.5 text-right tabular-nums">{brl(boletim.totalMedido)}</td>
                  </tr>
                </tfoot>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// FormBoletim — formulário de nova medição boletim
// ---------------------------------------------------------------------------

function FormBoletim({
  obraId, orcamentos, onSalvo, onCancelar,
}: {
  obraId: string
  orcamentos: OrcamentoResumido[]
  onSalvo: () => void
  onCancelar: () => void
}) {
  const [isPending, startTransition] = useTransition()

  const [orcamentoId, setOrcamentoId]         = useState(orcamentos[0]?.id ?? '')
  const [etapasOrcamento, setEtapasOrcamento] = useState<EtapaOrcamento[]>([])
  const [loadingEtapas, setLoadingEtapas]     = useState(false)
  const [percEtapas, setPercEtapas]           = useState<Record<string, string>>({})

  const [descricao,    setDescricao]    = useState('')
  const [dataMedicao,  setDataMedicao]  = useState('')
  const [erro, setErro]                 = useState<string | null>(null)

  // Calcula preview ao vivo
  const orcSelecionado = orcamentos.find((o) => o.id === orcamentoId) ?? null
  let   valorTotal     = 0
  for (const et of etapasOrcamento) {
    const pct = parseFloat((percEtapas[et.etapa] ?? '0').replace(',', '.')) || 0
    valorTotal += et.valorOrcado * (pct / 100)
  }
  const totalOrcamento = orcSelecionado?.total ?? 0
  const percGlobal     = totalOrcamento > 0 ? (valorTotal / totalOrcamento) * 100 : 0

  const carregarEtapas = useCallback(async (id: string) => {
    if (!id) return
    setLoadingEtapas(true)
    setPercEtapas({})
    const res = await listarEtapasOrcamento(id)
    if (res.data) setEtapasOrcamento(res.data)
    else setErro(res.error ?? 'Erro ao carregar etapas.')
    setLoadingEtapas(false)
  }, [])

  useEffect(() => {
    if (orcamentoId) carregarEtapas(orcamentoId)
  }, [orcamentoId, carregarEtapas])

  function handleSalvar() {
    if (!descricao.trim()) return setErro('Descrição obrigatória.')
    if (!orcamentoId)      return setErro('Selecione um orçamento.')
    if (etapasOrcamento.length === 0) return setErro('Orçamento sem etapas.')

    const etapasDados = etapasOrcamento.map((et) => ({
      etapa:      et.etapa,
      percentual: parseFloat((percEtapas[et.etapa] ?? '0').replace(',', '.')) || 0,
    }))

    setErro(null)
    startTransition(async () => {
      const res = await criarMedicaoBoletim({
        obraId,
        orcamentoId,
        descricao,
        data_medicao: dataMedicao || null,
        etapas: etapasDados,
      })
      if (res.error) { setErro(res.error); return }
      onSalvo()
    })
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
      <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Novo boletim físico-financeiro</p>

      {/* Orçamento */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground font-medium">Orçamento de referência *</label>
        <select
          value={orcamentoId}
          onChange={(e) => setOrcamentoId(e.target.value)}
          className={inp}
        >
          <option value="">Selecione o orçamento</option>
          {orcamentos.map((o) => (
            <option key={o.id} value={o.id}>
              {o.titulo}{o.total != null ? ` — ${brl(o.total)}` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Descrição + data */}
      <div className="grid grid-cols-2 gap-2">
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Descrição da medição *"
          className={inp}
        />
        <input
          type="date"
          value={dataMedicao}
          onChange={(e) => setDataMedicao(e.target.value)}
          className={inp}
          title="Data da medição"
        />
      </div>

      {/* Tabela de % por etapa */}
      {loadingEtapas && (
        <div className="flex items-center gap-2">
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Carregando etapas…</span>
        </div>
      )}

      {!loadingEtapas && etapasOrcamento.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr className="text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Etapa</th>
                <th className="px-3 py-2 text-right font-medium">Valor orçado</th>
                <th className="px-3 py-2 text-right font-medium w-28">% acumulado</th>
                <th className="px-3 py-2 text-right font-medium">Valor medido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {etapasOrcamento.map((et) => {
                const pct = parseFloat((percEtapas[et.etapa] ?? '0').replace(',', '.')) || 0
                const vm  = et.valorOrcado * (pct / 100)
                return (
                  <tr key={et.etapa} className="bg-background hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 font-medium text-foreground">{et.etapa}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{brl(et.valorOrcado)}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={percEtapas[et.etapa] ?? ''}
                        onChange={(e) => setPercEtapas((prev) => ({ ...prev, [et.etapa]: e.target.value }))}
                        placeholder="0"
                        className="h-8 w-24 rounded border border-border bg-background px-2 text-right text-xs outline-none focus:border-foreground/40 tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-foreground">{brl(vm)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-muted/50">
              <tr className="font-semibold text-foreground">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{brl(totalOrcamento)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{percGlobal.toFixed(1)}%</td>
                <td className="px-3 py-2 text-right tabular-nums">{brl(valorTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {!loadingEtapas && orcamentoId && etapasOrcamento.length === 0 && (
        <p className="text-xs text-muted-foreground">Este orçamento não possui etapas cadastradas.</p>
      )}

      {erro && <p className="text-xs text-destructive">{erro}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSalvar}
          disabled={isPending}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-foreground px-3 text-xs font-semibold text-background disabled:opacity-50"
        >
          {isPending ? <><Loader2 className="size-3 animate-spin" />Salvando…</> : 'Salvar boletim'}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="h-8 rounded-lg border border-border px-3 text-xs font-medium text-foreground hover:bg-accent"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component principal
// ---------------------------------------------------------------------------

export function ObrasDetalheTabs({
  obraId, etapas, medicoes, podeExcluir, equipe,
  colaboradoresDisponiveis, orcamentos,
}: Props) {
  const router = useRouter()
  const [aba, setAba] = useState<'etapas' | 'medicoes' | 'equipe'>('etapas')
  const [isPending, startTransition] = useTransition()

  // Etapa form
  const [showEtapaForm, setShowEtapaForm] = useState(false)
  const [etapaNome,   setEtapaNome]   = useState('')
  const [etapaPerc,  setEtapaPerc]  = useState('')
  const [etapaValor, setEtapaValor] = useState('')
  const [etapaData,  setEtapaData]  = useState('')
  const [etapaErro,  setEtapaErro]  = useState<string | null>(null)

  // Medição boletim form
  const [showBoletimForm, setShowBoletimForm] = useState(false)

  // Equipe form
  const [showEquipeForm,    setShowEquipeForm]    = useState(false)
  const [novoColaboradorId, setNovoColaboradorId] = useState('')
  const [novaFuncao,        setNovaFuncao]        = useState('')
  const [novaDataInicio,    setNovaDataInicio]    = useState('')
  const [equipeErro,        setEquipeErro]        = useState<string | null>(null)

  function tabCls(t: typeof aba) {
    return `flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
      aba === t
        ? 'border-foreground text-foreground'
        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
    }`
  }

  // --- Etapa actions ---
  function handleAddEtapa() {
    if (!etapaNome.trim()) return setEtapaErro('Nome obrigatório.')
    setEtapaErro(null)
    const perc  = etapaPerc  ? parseFloat(etapaPerc.replace(',', '.'))  : null
    const valor = etapaValor ? parseFloat(etapaValor.replace(/\./g, '').replace(',', '.')) : null
    startTransition(async () => {
      const res = await criarEtapa(obraId, {
        nome: etapaNome, percentual_obra: perc, valor, data_previsao: etapaData || null,
        ordem: etapas.length,
      })
      if (res.error) { setEtapaErro(res.error); return }
      setEtapaNome(''); setEtapaPerc(''); setEtapaValor(''); setEtapaData('')
      setShowEtapaForm(false)
      router.refresh()
    })
  }

  function handleStatusEtapa(etapaId: string, status: string) {
    const next = ETAPA_STATUS_NEXT[status] as 'pendente' | 'em_andamento' | 'concluida'
    startTransition(async () => {
      await atualizarStatusEtapa(etapaId, obraId, next)
      router.refresh()
    })
  }

  function handleDeleteEtapa(etapaId: string) {
    if (!confirm('Excluir esta etapa?')) return
    startTransition(async () => { await excluirEtapa(etapaId, obraId); router.refresh() })
  }

  // --- Medição actions ---
  function handleStatusMedicao(medicaoId: string, status: string) {
    const next = MEDICAO_STATUS_NEXT[status] as 'pendente' | 'aprovada' | 'faturada'
    startTransition(async () => { await atualizarStatusMedicao(medicaoId, obraId, next); router.refresh() })
  }

  function handleDeleteMedicao(medicaoId: string) {
    if (!confirm('Excluir esta medição?')) return
    startTransition(async () => { await excluirMedicao(medicaoId, obraId); router.refresh() })
  }

  // --- Equipe actions ---
  function handleAddEquipe() {
    if (!novoColaboradorId) return setEquipeErro('Selecione um colaborador.')
    setEquipeErro(null)
    startTransition(async () => {
      const res = await adicionarColaboradorObra(
        obraId,
        novoColaboradorId,
        novaFuncao || null,
        novaDataInicio || null,
      )
      if (res.error) { setEquipeErro(res.error); return }
      setNovoColaboradorId(''); setNovaFuncao(''); setNovaDataInicio('')
      setShowEquipeForm(false)
      router.refresh()
    })
  }

  function handleRemoverEquipe(obraColaboradorId: string) {
    if (!confirm('Remover este colaborador da obra?')) return
    startTransition(async () => {
      await removerColaboradorObra(obraColaboradorId, obraId)
      router.refresh()
    })
  }

  // --- Curva S: calcula pontos acumulados ---
  const pontosCurvaS: PontoMedicao[] = medicoes
    .slice()
    .sort((a, b) => a.numero_medicao - b.numero_medicao)
    .reduce<PontoMedicao[]>((acc, med, i) => {
      const anterior = acc[i - 1]?.valorAcumulado ?? 0
      acc.push({
        numero_medicao:  med.numero_medicao,
        valorAcumulado:  anterior + (med.valor ?? 0),
      })
      return acc
    }, [])

  // Valor total do primeiro orçamento com valor (para meta)
  const totalOrcamentoPrincipal = orcamentos.find((o) => o.total != null)?.total ?? undefined

  return (
    <div className="flex flex-col gap-0">
      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-border overflow-x-auto">
        <button type="button" className={tabCls('etapas')} onClick={() => setAba('etapas')}>
          <ListChecks className="size-4 shrink-0" />
          Etapas
          {etapas.length > 0 && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${aba === 'etapas' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
              {etapas.length}
            </span>
          )}
        </button>
        <button type="button" className={tabCls('medicoes')} onClick={() => setAba('medicoes')}>
          <BarChart3 className="size-4 shrink-0" />
          Medições
          {medicoes.length > 0 && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${aba === 'medicoes' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
              {medicoes.length}
            </span>
          )}
        </button>
        <button type="button" className={tabCls('equipe')} onClick={() => setAba('equipe')}>
          <Users className="size-4 shrink-0" />
          Equipe
          {equipe.length > 0 && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${aba === 'equipe' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
              {equipe.length}
            </span>
          )}
        </button>
      </div>

      {/* Aba Etapas */}
      {aba === 'etapas' && (
        <div className="flex flex-col gap-3 pt-4">
          {etapas.length === 0 && !showEtapaForm && (
            <p className="text-sm text-muted-foreground">Nenhuma etapa cadastrada. Adicione fases para acompanhar o progresso.</p>
          )}

          {etapas.map((et) => (
            <div key={et.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              <button
                type="button"
                onClick={() => handleStatusEtapa(et.id, et.status)}
                disabled={isPending}
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-opacity hover:opacity-70 disabled:opacity-50 ${ETAPA_STATUS_CLASS[et.status] ?? ''}`}
                title="Clique para avançar o status"
              >
                {ETAPA_STATUS_LABEL[et.status] ?? et.status}
              </button>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{et.nome}</p>
                <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  {et.percentual_obra != null && <span>{et.percentual_obra}% da obra</span>}
                  {et.valor != null && <span>{brl(et.valor)}</span>}
                  {et.data_previsao && <span>Prev: {fmt(et.data_previsao)}</span>}
                  {et.data_conclusao && <span className="text-green-600">Concluída: {fmt(et.data_conclusao)}</span>}
                </div>
              </div>

              {podeExcluir && (
                <button type="button" onClick={() => handleDeleteEtapa(et.id)} disabled={isPending}
                  className="shrink-0 text-muted-foreground/50 transition-colors hover:text-destructive disabled:opacity-50">
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          ))}

          {showEtapaForm ? (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
              <input value={etapaNome} onChange={(e) => setEtapaNome(e.target.value)}
                placeholder="Nome da etapa *" className={inp} />
              <div className="grid grid-cols-3 gap-2">
                <input value={etapaPerc} onChange={(e) => setEtapaPerc(e.target.value)}
                  placeholder="% da obra" className={inp} inputMode="decimal" />
                <input value={etapaValor} onChange={(e) => setEtapaValor(e.target.value)}
                  placeholder="Valor (R$)" className={inp} inputMode="decimal" />
                <input type="date" value={etapaData} onChange={(e) => setEtapaData(e.target.value)}
                  className={inp} />
              </div>
              {etapaErro && <p className="text-xs text-destructive">{etapaErro}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={handleAddEtapa} disabled={isPending}
                  className="h-8 rounded-lg bg-foreground px-3 text-xs font-semibold text-background disabled:opacity-50">
                  {isPending ? 'Salvando…' : 'Adicionar'}
                </button>
                <button type="button" onClick={() => { setShowEtapaForm(false); setEtapaErro(null) }}
                  className="h-8 rounded-lg border border-border px-3 text-xs font-medium text-foreground hover:bg-accent">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowEtapaForm(true)}
              className="flex items-center gap-1.5 self-start rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground">
              <Plus className="size-3.5" />
              Nova etapa
            </button>
          )}
        </div>
      )}

      {/* Aba Medições */}
      {aba === 'medicoes' && (
        <div className="flex flex-col gap-3 pt-4">
          {/* Curva S */}
          {medicoes.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Curva S — valor acumulado por medição
              </p>
              <CurvaSChart
                pontos={pontosCurvaS}
                valorTotalOrcamento={totalOrcamentoPrincipal != null ? totalOrcamentoPrincipal : undefined}
              />
            </div>
          )}

          {medicoes.length === 0 && !showBoletimForm && (
            <p className="text-sm text-muted-foreground">Nenhuma medição cadastrada. Crie o primeiro boletim físico-financeiro.</p>
          )}

          {/* Lista de medições */}
          {medicoes.map((med) => (
            <MedicaoBoletimRow
              key={med.id}
              med={med}
              podeExcluir={podeExcluir}
              isPending={isPending}
              onStatusChange={handleStatusMedicao}
              onDelete={handleDeleteMedicao}
            />
          ))}

          {/* Formulário boletim */}
          {showBoletimForm ? (
            <FormBoletim
              obraId={obraId}
              orcamentos={orcamentos}
              onSalvo={() => { setShowBoletimForm(false); router.refresh() }}
              onCancelar={() => setShowBoletimForm(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowBoletimForm(true)}
              className="flex items-center gap-1.5 self-start rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              <Plus className="size-3.5" />
              Novo boletim de medição
            </button>
          )}
        </div>
      )}

      {/* Aba Equipe */}
      {aba === 'equipe' && (
        <div className="flex flex-col gap-3 pt-4">
          {equipe.length === 0 && !showEquipeForm && (
            <p className="text-sm text-muted-foreground">
              Nenhum colaborador designado para esta obra. Adicione a equipe para controlar o ponto por centro de custo.
            </p>
          )}

          {equipe.map((eq) => (
            <div key={eq.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                <Users className="size-4 text-muted-foreground" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{eq.colaborador_nome}</p>
                <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  {eq.funcao && <span>{eq.funcao}</span>}
                  {eq.data_inicio && <span>desde {fmt(eq.data_inicio)}</span>}
                  {!eq.ativo && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">Inativo</span>
                  )}
                </div>
              </div>

              {podeExcluir && (
                <button
                  type="button"
                  onClick={() => handleRemoverEquipe(eq.id)}
                  disabled={isPending}
                  className="shrink-0 text-muted-foreground/50 transition-colors hover:text-destructive disabled:opacity-50"
                  title="Remover da obra"
                >
                  <UserMinus className="size-3.5" />
                </button>
              )}
            </div>
          ))}

          {showEquipeForm ? (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
              <select
                value={novoColaboradorId}
                onChange={(e) => setNovoColaboradorId(e.target.value)}
                className={inp}
              >
                <option value="">Selecione o colaborador *</option>
                {colaboradoresDisponiveis
                  .filter((c) => !equipe.some((e) => e.colaborador_id === c.id))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}{c.cargo ? ` — ${c.cargo}` : ''}
                    </option>
                  ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={novaFuncao}
                  onChange={(e) => setNovaFuncao(e.target.value)}
                  placeholder="Função na obra (ex: Pedreiro)"
                  className={inp}
                />
                <input
                  type="date"
                  value={novaDataInicio}
                  onChange={(e) => setNovaDataInicio(e.target.value)}
                  className={inp}
                  title="Data de início na obra"
                />
              </div>
              {equipeErro && <p className="text-xs text-destructive">{equipeErro}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddEquipe}
                  disabled={isPending}
                  className="flex h-8 items-center gap-1.5 rounded-lg bg-foreground px-3 text-xs font-semibold text-background disabled:opacity-50"
                >
                  {isPending ? <><Loader2 className="size-3 animate-spin" />Adicionando…</> : 'Adicionar'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowEquipeForm(false); setEquipeErro(null); setNovoColaboradorId('') }}
                  className="h-8 rounded-lg border border-border px-3 text-xs font-medium text-foreground hover:bg-accent"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowEquipeForm(true)}
              className="flex items-center gap-1.5 self-start rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              <Plus className="size-3.5" />
              Adicionar colaborador
            </button>
          )}
        </div>
      )}
    </div>
  )
}
