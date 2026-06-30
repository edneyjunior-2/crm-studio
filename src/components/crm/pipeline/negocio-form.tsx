'use client'

import { useState, useTransition, useEffect, useId } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { createNegocio, updateNegocio } from '@/app/(crm)/pipeline/actions'
import { getNegocioProdutos } from '@/app/(crm)/pipeline/produtos-actions'
import type { NegocioComRelacoes, EstagioNegocio, Cliente, Solucao, Parceiro, Profile } from '@/types'
import type { EstagioPipeline } from '@/lib/pipeline-estagios'

// ── Utilidades de formatação BR ──────────────────────────────────────────────

function formatBRLInput(raw: string): string {
  // Remove tudo que não é dígito
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  // Trata como centavos: últimos 2 dígitos são decimais
  const cents = parseInt(digits, 10)
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

function parseBRLInput(formatted: string): number {
  if (!formatted) return 0
  // Remove pontos de milhar, troca vírgula por ponto
  return Number(formatted.replace(/\./g, '').replace(',', '.')) || 0
}

function formatBRLDisplay(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

// ── Linha de produto ──────────────────────────────────────────────────────────

interface ProdutoLinha {
  /** key único apenas para React list reconciliation */
  key: string
  solucaoId: string | null
  valorFormatado: string // ex: "1.234,56"
}

function novaProdutoLinha(solucaoId?: string | null, valor?: number): ProdutoLinha {
  return {
    key: Math.random().toString(36).slice(2),
    solucaoId: solucaoId ?? null,
    valorFormatado: valor ? formatBRLInput(String(Math.round(valor * 100))) : '',
  }
}

// ── Indicador: Parceiro ou Membro do Time ────────────────────────────────────

type IndicadorTipo = 'parceiro' | 'time' | null
const PREFIX_PARCEIRO = 'p:'
const PREFIX_TIME = 't:'

function encodeIndicador(tipo: IndicadorTipo, id: string | null): string {
  if (!tipo || !id) return ''
  return tipo === 'parceiro' ? `${PREFIX_PARCEIRO}${id}` : `${PREFIX_TIME}${id}`
}

function decodeIndicador(value: string): { tipo: IndicadorTipo; id: string | null } {
  if (value.startsWith(PREFIX_PARCEIRO))
    return { tipo: 'parceiro', id: value.slice(PREFIX_PARCEIRO.length) }
  if (value.startsWith(PREFIX_TIME))
    return { tipo: 'time', id: value.slice(PREFIX_TIME.length) }
  return { tipo: null, id: null }
}

// ── Props ────────────────────────────────────────────────────────────────────

interface NegocioFormProps {
  negocio?: NegocioComRelacoes
  clientes: Pick<Cliente, 'id' | 'razao_social'>[]
  solucoes: Pick<Solucao, 'id' | 'nome'>[]
  estagios: EstagioPipeline[]
  trigger: React.ReactNode
  defaultEstagio?: EstagioNegocio
  parceiros?: Pick<Parceiro, 'id' | 'nome'>[]
  membrosTime?: Pick<Profile, 'id' | 'full_name'>[]
}

// ── Componente ───────────────────────────────────────────────────────────────

export function NegocioForm({
  negocio,
  clientes,
  solucoes,
  estagios,
  trigger,
  defaultEstagio,
  parceiros = [],
  membrosTime = [],
}: NegocioFormProps) {
  const uid = useId()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isLoadingProdutos, setIsLoadingProdutos] = useState(false)
  const [erroProdutos, setErroProdutos] = useState(false)

  const [estagio, setEstagio] = useState<EstagioNegocio>(
    negocio?.estagio ?? defaultEstagio ?? (estagios.find((e) => e.tipo === 'aberto')?.slug ?? estagios[0]?.slug ?? '') as EstagioNegocio
  )
  const [clienteId, setClienteId] = useState<string | null>(negocio?.cliente_id ?? null)

  // ── Produtos (linha repetível) ────────────────────────────────────────────
  const [produtos, setProdutos] = useState<ProdutoLinha[]>([
    novaProdutoLinha(negocio?.solucao_id, negocio?.valor_estimado ?? undefined),
  ])
  const [produtosCarregados, setProdutosCarregados] = useState(false)

  // ── Indicador ─────────────────────────────────────────────────────────────
  // Determina valor inicial do indicador
  function resolveIndicadorInicial(): string {
    if (negocio?.parceiro_id) return encodeIndicador('parceiro', negocio.parceiro_id)
    if (negocio?.indicado_por) return encodeIndicador('time', negocio.indicado_por)
    return ''
  }
  const [indicadorValue, setIndicadorValue] = useState<string>(resolveIndicadorInicial())

  // Label para exibir no trigger do Select de indicador
  function indicadorLabel(): string {
    if (!indicadorValue) return ''
    const { tipo, id } = decodeIndicador(indicadorValue)
    if (tipo === 'parceiro') {
      return parceiros.find((p) => p.id === id)?.nome ?? '—'
    }
    if (tipo === 'time') {
      return membrosTime.find((m) => m.id === id)?.full_name ?? '—'
    }
    return ''
  }

  // Quando abre o form em modo edição, carrega os produtos do negócio
  useEffect(() => {
    if (!open) return
    if (!negocio) {
      // Criação: reset para 1 linha vazia
      setProdutos([novaProdutoLinha()])
      setProdutosCarregados(false)
      setErroProdutos(false)
      setIndicadorValue(resolveIndicadorInicial())
      return
    }
    if (produtosCarregados) return

    setIsLoadingProdutos(true)
    setErroProdutos(false)
    getNegocioProdutos(negocio.id)
      .then((rows) => {
        if (rows.length > 0) {
          setProdutos(rows.map((r) => novaProdutoLinha(r.solucao_id, r.valor)))
        } else {
          // Deal antigo sem produtos: semeia 1 linha com solucao_id + valor_estimado
          setProdutos([novaProdutoLinha(negocio.solucao_id, negocio.valor_estimado ?? undefined)])
        }
        setProdutosCarregados(true)
      })
      .catch(() => {
        setErroProdutos(true)
        toast.error('Erro ao carregar produtos do negócio.')
      })
      .finally(() => setIsLoadingProdutos(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, negocio?.id])

  function handleOpenChange(nextOpen: boolean) {
    if (!isPending) setOpen(nextOpen)
  }

  // ── Produtos: mutações ────────────────────────────────────────────────────

  function addProduto() {
    setProdutos((prev) => [...prev, novaProdutoLinha()])
  }

  function removeProduto(key: string) {
    setProdutos((prev) => (prev.length > 1 ? prev.filter((p) => p.key !== key) : prev))
  }

  function setProdutoSolucao(key: string, solucaoId: string | null) {
    setProdutos((prev) =>
      prev.map((p) => (p.key === key ? { ...p, solucaoId } : p))
    )
  }

  function setProdutoValor(key: string, raw: string) {
    const formatted = formatBRLInput(raw)
    setProdutos((prev) =>
      prev.map((p) => (p.key === key ? { ...p, valorFormatado: formatted } : p))
    )
  }

  // Total ao vivo
  const total = produtos.reduce((acc, p) => acc + parseBRLInput(p.valorFormatado), 0)

  // Primeira solução válida (para solucao_id da linha 1)
  const primeiraSolucaoId = produtos[0]?.solucaoId ?? ''

  // ── Submit ─────────────────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)

    formData.set('estagio', estagio)
    formData.set('cliente_id', clienteId ?? '')
    // solucao_id = primeira solução (NOT NULL no banco)
    formData.set('solucao_id', primeiraSolucaoId)

    // Serializa produtos
    formData.set('produtos_count', String(produtos.length))
    produtos.forEach((p, i) => {
      formData.set(`produto_solucao_${i}`, p.solucaoId ?? '')
      formData.set(`produto_valor_${i}`, p.valorFormatado)
    })

    // Indicador
    const { tipo: indTipo, id: indId } = decodeIndicador(indicadorValue)
    formData.set('parceiro_id', indTipo === 'parceiro' && indId ? indId : '')
    formData.set('indicado_por', indTipo === 'time' && indId ? indId : '')

    startTransition(async () => {
      const result = negocio
        ? await updateNegocio(negocio.id, formData)
        : await createNegocio(formData)

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(
        negocio ? 'Negócio atualizado com sucesso.' : 'Negócio criado com sucesso.'
      )
      setOpen(false)

      if (!negocio) {
        form.reset()
        const primeiroAberto = estagios.find((e) => e.tipo === 'aberto')?.slug ?? estagios[0]?.slug ?? ''
        setEstagio((defaultEstagio ?? primeiroAberto) as EstagioNegocio)
        setClienteId(null)
        setProdutos([novaProdutoLinha()])
        setProdutosCarregados(false)
        setIndicadorValue('')
      }
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <span onClick={() => setOpen(true)} style={{ display: 'contents' }}>
        {trigger}
      </span>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {negocio ? 'Editar negócio' : 'Novo negócio'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Título */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${uid}-titulo`}>
                Título <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`${uid}-titulo`}
                name="titulo"
                required
                defaultValue={negocio?.titulo}
                placeholder="Ex: Implantação ERP — Empresa XYZ"
              />
            </div>

            {/* Cliente + Estágio */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>
                  Cliente <span className="text-destructive">*</span>
                </Label>
                <Select value={clienteId} onValueChange={setClienteId}>
                  <SelectTrigger className="w-full">
                    {clienteId ? (
                      <span className="flex flex-1 truncate text-left">
                        {clientes.find((c) => c.id === clienteId)?.razao_social ?? '—'}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Selecione...</span>
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>
                  Estágio <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={estagio}
                  onValueChange={(v) => setEstagio(v as EstagioNegocio)}
                >
                  <SelectTrigger className="w-full">
                    {estagios.find((e) => e.slug === estagio)?.nome ?? (
                      <span className="text-muted-foreground">Selecione...</span>
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {(negocio ? estagios : estagios.filter((e) => e.tipo === 'aberto')).map((e) => (
                      <SelectItem key={e.slug} value={e.slug}>
                        {e.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ── PRODUTOS ─────────────────────────────────────────────────── */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label>Produtos / Soluções</Label>
                {isLoadingProdutos && (
                  <span className="text-xs text-muted-foreground">Carregando...</span>
                )}
              </div>
              {erroProdutos && (
                <p className="text-xs text-destructive">
                  Não foi possível carregar os produtos — reabra para tentar de novo.
                </p>
              )}

              <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3">
                {produtos.map((prod, idx) => (
                  <div key={prod.key} className="flex items-center gap-2">
                    {/* Solução */}
                    <div className="flex-1 min-w-0">
                      <Select
                        value={prod.solucaoId ?? ''}
                        onValueChange={(v) => setProdutoSolucao(prod.key, v || null)}
                      >
                        <SelectTrigger className="w-full">
                          {prod.solucaoId ? (
                            <span className="flex flex-1 truncate text-left text-sm">
                              {solucoes.find((s) => s.id === prod.solucaoId)?.nome ?? '—'}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">Solução...</span>
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {solucoes.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Valor BR */}
                    <div className="w-36 shrink-0">
                      <Input
                        inputMode="numeric"
                        placeholder="0,00"
                        value={prod.valorFormatado}
                        onChange={(e) => setProdutoValor(prod.key, e.target.value)}
                        aria-label={`Valor do produto ${idx + 1}`}
                        className="text-right"
                      />
                    </div>

                    {/* Remover linha */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={produtos.length === 1}
                      onClick={() => removeProduto(prod.key)}
                      aria-label="Remover produto"
                      className="shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-30"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}

                {/* Adicionar produto + Total */}
                <div className="flex items-center justify-between pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addProduto}
                    className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="size-3.5" />
                    Adicionar produto
                  </Button>

                  <span className="text-sm font-semibold text-foreground">
                    Total: {formatBRLDisplay(total)}
                  </span>
                </div>
              </div>
            </div>

            {/* Probabilidade + Data de Previsão */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${uid}-prob`}>Probabilidade (%)</Label>
                <Input
                  id={`${uid}-prob`}
                  name="probabilidade"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={negocio?.probabilidade ?? ''}
                  placeholder="0 a 100"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${uid}-data`}>Previsão de Fechamento</Label>
                <Input
                  id={`${uid}-data`}
                  name="data_previsao_fechamento"
                  type="date"
                  defaultValue={negocio?.data_previsao_fechamento ?? ''}
                />
              </div>
            </div>

            {/* ── INDICADOR ─────────────────────────────────────────────────── */}
            {(parceiros.length > 0 || membrosTime.length > 0) && (
              <div className="flex flex-col gap-1.5">
                <Label>Indicador</Label>
                <Select value={indicadorValue} onValueChange={(v) => setIndicadorValue(v ?? '')}>
                  <SelectTrigger className="w-full">
                    {indicadorValue ? (
                      <span className="flex flex-1 truncate text-left">
                        {indicadorLabel()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Nenhum...</span>
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>

                    {parceiros.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                          Parceiros
                        </div>
                        {parceiros.map((p) => (
                          <SelectItem key={p.id} value={encodeIndicador('parceiro', p.id)}>
                            {p.nome}
                          </SelectItem>
                        ))}
                      </>
                    )}

                    {membrosTime.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                          Time
                        </div>
                        {membrosTime.map((m) => (
                          <SelectItem key={m.id} value={encodeIndicador('time', m.id)}>
                            {m.full_name}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Observações */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${uid}-obs`}>Observações</Label>
              <Textarea
                id={`${uid}-obs`}
                name="observacoes"
                defaultValue={negocio?.observacoes ?? ''}
                placeholder="Informações adicionais sobre o negócio..."
                rows={3}
              />
            </div>

            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                Cancelar
              </DialogClose>
              <Button
                type="submit"
                disabled={isPending || isLoadingProdutos || erroProdutos || !clienteId || !primeiraSolucaoId}
              >
                {isPending
                  ? 'Salvando...'
                  : negocio
                    ? 'Salvar alterações'
                    : 'Criar negócio'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
