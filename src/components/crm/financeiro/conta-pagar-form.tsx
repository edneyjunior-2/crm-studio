'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { CreditCard, QrCode, Phone, Plus, Copy, ExternalLink } from 'lucide-react'
import { createContaPagar, updateContaPagar, uploadComprovante } from '@/app/(crm)/financeiro/actions'
import { createFornecedor } from '@/app/(crm)/financeiro/fornecedores/actions'
import type { ContaPagar, Fornecedor, Moeda } from '@/types'
import { MOEDAS } from '@/lib/moedas'

const PIX_TIPO_LABELS: Record<string, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  telefone: 'Telefone',
  aleatoria: 'Aleatória',
}

const PIX_TIPOS = [
  { value: 'cpf',       label: 'CPF',            placeholder: '000.000.000-00' },
  { value: 'cnpj',      label: 'CNPJ',           placeholder: '00.000.000/0001-00' },
  { value: 'email',     label: 'E-mail',          placeholder: 'nome@email.com' },
  { value: 'telefone',  label: 'Telefone',        placeholder: '+55 11 99999-9999' },
  { value: 'aleatoria', label: 'Chave Aleatória', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
]

type FornecedorLite = Pick<Fornecedor, 'id' | 'nome' | 'pix_tipo' | 'pix_chave' | 'telefone'>

export type ContaPagarSugestao = Pick<
  ContaPagar,
  'id' | 'descricao' | 'fornecedor_id' | 'categoria' | 'moeda' | 'recorrente' | 'frequencia' | 'is_cartao'
>

interface ContaPagarFormProps {
  conta?: ContaPagar
  trigger: React.ReactNode
  fornecedores?: FornecedorLite[]
  sugestoes?: ContaPagarSugestao[]
}

const STATUS_OPTIONS = [
  { value: 'pendente',  label: 'Pendente' },
  { value: 'pago',      label: 'Pago' },
  { value: 'atrasado',  label: 'Atrasado' },
  { value: 'cancelado', label: 'Cancelado' },
]

const CATEGORIAS = [
  'Aluguel',
  'Salários',
  'Serviços',
  'Fornecedores',
  'Marketing',
  'Infraestrutura',
  'Impostos',
  'Investimento',
  'Outros',
]

const FREQUENCIAS = [
  { value: 'semanal',   label: 'Semanal' },
  { value: 'mensal',    label: 'Mensal' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual',     label: 'Anual' },
]

export function ContaPagarForm({ conta, trigger, fornecedores = [], sugestoes = [] }: ContaPagarFormProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<string>(conta?.status ?? 'pendente')
  const [moeda, setMoeda] = useState<Moeda>(conta?.moeda ?? 'BRL')
  const [categoria, setCategoria] = useState<string | null>(conta?.categoria ?? null)
  const [recorrente, setRecorrente] = useState<boolean>(conta?.recorrente ?? false)
  const [frequencia, setFrequencia] = useState<string | null>(conta?.frequencia ?? null)
  const [recorrenteAte, setRecorrenteAte] = useState<string>('')
  const [cartao, setCartao] = useState<boolean>(conta?.is_cartao ?? false)
  const [numParcelas, setNumParcelas] = useState<number>(2)
  const [cartaoInfo, setCartaoInfo] = useState<string>(conta?.cartao_info ?? '')
  const [fornecedorId, setFornecedorId] = useState<string | null>(conta?.fornecedor_id ?? null)
  const [localFornecedores, setLocalFornecedores] = useState<FornecedorLite[]>(fornecedores)

  // Autocomplete de descrição
  const [descricao, setDescricao] = useState<string>(conta?.descricao ?? '')
  const [sugestoesVisiveis, setSugestoesVisiveis] = useState<ContaPagarSugestao[]>([])
  const [sugestaoFocada, setSugestaoFocada] = useState<number>(-1)
  const descricaoRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Dados de pagamento
  const [pixCopaCola, setPixCopaCola] = useState<string>(conta?.pix_copia_cola ?? '')
  const [codigoBoleto, setCodigoBoleto] = useState<string>(conta?.codigo_boleto ?? '')

  // Comprovante de pagamento
  const [comprovanteUrl, setComprovanteUrl] = useState<string>(conta?.comprovante_url ?? '')
  const [comprovanteFile, setComprovanteFile] = useState<File | null>(null)
  const [comprovantePreview, setComprovantePreview] = useState<string>('')
  const [isPendingUpload, startTransitionUpload] = useTransition()

  // Novo fornecedor inline
  const [novoFornOpen, setNovoFornOpen] = useState(false)
  const [isPendingNovoForn, startTransitionNovoForn] = useTransition()
  const [novoNome, setNovoNome] = useState('')
  const [novoTelefone, setNovoTelefone] = useState('')
  const [novoPixTipo, setNovoPixTipo] = useState('')
  const [novoPixChave, setNovoPixChave] = useState('')

  const fornecedorSelecionado = localFornecedores.find((f) => f.id === fornecedorId) ?? null

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        descricaoRef.current &&
        !descricaoRef.current.contains(e.target as Node)
      ) {
        setSugestoesVisiveis([])
        setSugestaoFocada(-1)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleDescricaoChange(value: string) {
    setDescricao(value)
    if (!conta && value.trim().length >= 2) {
      const filtradas = sugestoes
        .filter((s) => s.descricao.toLowerCase().includes(value.toLowerCase()))
        .slice(0, 6)
      setSugestoesVisiveis(filtradas)
    } else {
      setSugestoesVisiveis([])
    }
    setSugestaoFocada(-1)
  }

  function handleSelecionarSugestao(s: ContaPagarSugestao) {
    setDescricao(s.descricao)
    setFornecedorId(s.fornecedor_id ?? null)
    setCategoria(s.categoria ?? null)
    setMoeda((s.moeda as Moeda) ?? 'BRL')
    setRecorrente(s.recorrente ?? false)
    setFrequencia(s.frequencia ?? null)
    setCartao(s.is_cartao ?? false)
    setSugestoesVisiveis([])
    setSugestaoFocada(-1)
  }

  function handleDescricaoKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (sugestoesVisiveis.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSugestaoFocada((prev) => Math.min(prev + 1, sugestoesVisiveis.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSugestaoFocada((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && sugestaoFocada >= 0) {
      e.preventDefault()
      handleSelecionarSugestao(sugestoesVisiveis[sugestaoFocada])
    } else if (e.key === 'Escape') {
      setSugestoesVisiveis([])
      setSugestaoFocada(-1)
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    // Bloqueia abertura durante submit, mas nunca bloqueia fechamento
    if (!nextOpen || !isPending) setOpen(nextOpen)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set('descricao', descricao)
    formData.set('status', status)
    formData.set('moeda', moeda)
    formData.set('categoria', categoria ?? '')
    formData.set('recorrente', recorrente ? 'true' : 'false')
    formData.set('frequencia', (recorrente && frequencia) ? frequencia : '')
    formData.set('recorrente_ate', (recorrente && recorrenteAte) ? recorrenteAte : '')
    formData.set('is_cartao', cartao ? 'true' : 'false')
    formData.set('num_parcelas', cartao ? String(numParcelas) : '')
    formData.set('cartao_info', cartaoInfo)
    formData.set('fornecedor_id', fornecedorId ?? '')
    formData.set('pix_copia_cola', pixCopaCola)
    formData.set('codigo_boleto', codigoBoleto)

    startTransition(async () => {
      const result = conta
        ? await updateContaPagar(conta.id, formData)
        : await createContaPagar(formData)

      if (result.error) {
        toast.error(result.error)
        return
      }

      const msg = conta
        ? 'Conta a pagar atualizada.'
        : cartao
          ? `${numParcelas} parcelas no cartão criadas.`
          : recorrente
            ? 'Parcelas recorrentes criadas com sucesso.'
            : 'Conta a pagar criada.'

      toast.success(msg)
      setOpen(false)
      if (!conta) {
        form.reset()
        setDescricao('')
        setStatus('pendente')
        setCategoria(null)
        setRecorrente(false)
        setFrequencia(null)
        setRecorrenteAte('')
        setCartao(false)
        setNumParcelas(2)
        setCartaoInfo('')
        setFornecedorId(null)
        setPixCopaCola('')
        setCodigoBoleto('')
      }
    })
  }

  function handleNovoFornSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData()
    formData.set('nome', novoNome)
    formData.set('telefone', novoTelefone)
    formData.set('pix_tipo', novoPixTipo)
    formData.set('pix_chave', novoPixChave)

    startTransitionNovoForn(async () => {
      const result = await createFornecedor(formData)
      if (result.error) {
        toast.error(result.error)
        return
      }
      if (result.data) {
        const novo: FornecedorLite = result.data as FornecedorLite
        setLocalFornecedores((prev) => [...prev, novo])
        setFornecedorId(result.data.id)
      }
      toast.success('Fornecedor cadastrado.')
      setNovoFornOpen(false)
      setNovoNome('')
      setNovoTelefone('')
      setNovoPixTipo('')
      setNovoPixChave('')
    })
  }

  function handleComprovanteChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setComprovanteFile(file)
    if (file.type.startsWith('image/')) {
      setComprovantePreview(URL.createObjectURL(file))
    } else {
      setComprovantePreview('')
    }
  }

  function handleUploadComprovante() {
    if (!comprovanteFile || !conta) return
    const fd = new FormData()
    fd.set('comprovante', comprovanteFile)
    startTransitionUpload(async () => {
      const result = await uploadComprovante(conta.id, fd)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setComprovanteUrl(result.url ?? '')
      setComprovanteFile(null)
      setComprovantePreview('')
      toast.success('Comprovante enviado com sucesso')
    })
  }

  return (
    <>
      <span onClick={() => setOpen(true)} style={{ display: 'contents' }}>
        {trigger}
      </span>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {conta ? 'Editar conta a pagar' : 'Nova conta a pagar'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="descricao">
                Descrição <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  ref={descricaoRef}
                  id="descricao"
                  name="descricao"
                  required
                  value={descricao}
                  onChange={(e) => handleDescricaoChange(e.target.value)}
                  onKeyDown={handleDescricaoKeyDown}
                  placeholder="Ex: Aluguel escritório março"
                  autoComplete="off"
                />
                {sugestoesVisiveis.length > 0 && (
                  <div
                    ref={dropdownRef}
                    className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md"
                  >
                    {sugestoesVisiveis.map((s, idx) => (
                      <button
                        key={s.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          handleSelecionarSugestao(s)
                        }}
                        className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-accent ${idx === sugestaoFocada ? 'bg-accent' : ''}`}
                      >
                        <span className="font-medium">{s.descricao}</span>
                        {(s.categoria || s.moeda !== 'BRL') && (
                          <span className="text-xs text-muted-foreground">
                            {[s.categoria, s.moeda !== 'BRL' ? s.moeda : null]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label>Fornecedor</Label>
                  <button
                    type="button"
                    onClick={() => setNovoFornOpen(true)}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Plus className="size-3" />
                    Novo fornecedor
                  </button>
                </div>
                <Select
                  value={fornecedorId ?? ''}
                  onValueChange={(v) => setFornecedorId(v || null)}
                >
                  <SelectTrigger className="w-full">
                    {fornecedorId ? (
                      <span className="flex flex-1 truncate text-left">
                        {fornecedorSelecionado?.nome ?? '—'}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Selecione um fornecedor...</span>
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {localFornecedores.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {fornecedorSelecionado && (
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    {fornecedorSelecionado.pix_chave && (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                        <QrCode className="size-3" />
                        {PIX_TIPO_LABELS[fornecedorSelecionado.pix_tipo ?? ''] ?? 'PIX'}:{' '}
                        {fornecedorSelecionado.pix_chave}
                      </span>
                    )}
                    {fornecedorSelecionado.telefone && (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-700/10">
                        <Phone className="size-3" />
                        {fornecedorSelecionado.telefone}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fornecedor">Nome livre</Label>
                  <Input
                    id="fornecedor"
                    name="fornecedor"
                    defaultValue={conta?.fornecedor ?? ''}
                    placeholder="Ou digite o nome"
                    disabled={!!fornecedorId}
                    className={fornecedorId ? 'opacity-50' : ''}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Categoria</Label>
                  <Select value={categoria ?? ''} onValueChange={(v) => setCategoria(v || null)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Moeda</Label>
              <Select value={moeda} onValueChange={(v) => { if (v) setMoeda(v as Moeda) }}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOEDAS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.flag} {m.value} — {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="valor">
                  Valor <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="valor"
                  name="valor"
                  type="number"
                  min={0}
                  step={0.01}
                  required
                  defaultValue={conta?.valor ?? ''}
                  placeholder="0,00"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="data_vencimento">
                  Vencimento <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="data_vencimento"
                  name="data_vencimento"
                  type="date"
                  required
                  defaultValue={conta?.data_vencimento ?? ''}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => { if (v) setStatus(v) }}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-3 flex flex-col gap-3">
              <p className="text-sm font-medium">Dados de Pagamento</p>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pix_copia_cola">PIX Copia e Cola</Label>
                  {pixCopaCola && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(pixCopaCola)
                        toast.success('PIX copiado.')
                      }}
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Copy className="size-3" />
                      Copiar
                    </button>
                  )}
                </div>
                <Textarea
                  id="pix_copia_cola"
                  name="pix_copia_cola"
                  rows={2}
                  value={pixCopaCola}
                  onChange={(e) => setPixCopaCola(e.target.value)}
                  placeholder="Cole aqui o código PIX copia e cola"
                  className="resize-none text-xs"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="codigo_boleto">Código de Boleto</Label>
                  {codigoBoleto && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(codigoBoleto)
                        toast.success('Código do boleto copiado.')
                      }}
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Copy className="size-3" />
                      Copiar
                    </button>
                  )}
                </div>
                <Textarea
                  id="codigo_boleto"
                  name="codigo_boleto"
                  rows={2}
                  value={codigoBoleto}
                  onChange={(e) => setCodigoBoleto(e.target.value)}
                  placeholder="Cole aqui a linha digitável do boleto"
                  className="resize-none text-xs"
                />
              </div>
            </div>

            {conta && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Comprovante de Pagamento</p>
                  {comprovanteUrl && (
                    <a
                      href={comprovanteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="size-3" />
                      Ver comprovante
                    </a>
                  )}
                </div>

                {comprovanteUrl && !comprovanteUrl.endsWith('.pdf') && (
                  <img
                    src={comprovanteUrl}
                    alt="Comprovante"
                    className="max-h-32 w-auto rounded-md object-contain border border-border"
                  />
                )}

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="comprovante" className="text-xs text-muted-foreground">
                    {comprovanteUrl ? 'Substituir comprovante' : 'Adicionar comprovante'}
                  </Label>
                  <input
                    id="comprovante"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={handleComprovanteChange}
                    className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary hover:file:bg-primary/20"
                  />
                  {comprovantePreview && (
                    <img
                      src={comprovantePreview}
                      alt="Preview"
                      className="max-h-24 w-auto rounded-md object-contain border border-border mt-1"
                    />
                  )}
                  {comprovanteFile && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="self-start"
                      onClick={handleUploadComprovante}
                      disabled={isPendingUpload}
                    >
                      {isPendingUpload ? 'Enviando...' : 'Enviar comprovante'}
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="rounded-lg border border-border bg-muted/40 p-3 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor="recorrente" className="cursor-pointer">
                    Conta Recorrente
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Gera parcelas futuras automaticamente ao criar
                  </p>
                </div>
                <Switch
                  id="recorrente"
                  checked={recorrente}
                  onCheckedChange={(v) => { setRecorrente(v); if (v) setCartao(false) }}
                  disabled={!!conta}
                />
              </div>

              {recorrente && (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label>
                        Frequência <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={frequencia ?? ''}
                        onValueChange={(v) => setFrequencia(v || null)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {FREQUENCIAS.map((f) => (
                            <SelectItem key={f.value} value={f.value}>
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="recorrente_ate">Até (opcional)</Label>
                      <Input
                        id="recorrente_ate"
                        type="date"
                        value={recorrenteAte}
                        onChange={(e) => setRecorrenteAte(e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {recorrenteAte && frequencia
                      ? `Parcelas geradas até ${new Date(recorrenteAte + 'T12:00:00').toLocaleDateString('pt-BR')}.`
                      : 'Sem limite definido, serão geradas as parcelas padrão da frequência.'}
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-3 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="size-4 text-muted-foreground" />
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="cartao" className="cursor-pointer">
                      Parcelado no Cartão
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Gera N parcelas mensais a partir do vencimento
                    </p>
                  </div>
                </div>
                <Switch
                  id="cartao"
                  checked={cartao}
                  onCheckedChange={(v) => { setCartao(v); if (v) setRecorrente(false) }}
                  disabled={!!conta}
                />
              </div>

              {cartao && (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="num_parcelas">
                        Nº de Parcelas <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="num_parcelas"
                        type="number"
                        min={2}
                        max={48}
                        value={numParcelas}
                        onChange={(e) => setNumParcelas(Math.max(2, parseInt(e.target.value) || 2))}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="cartao_info">Cartão Utilizado</Label>
                      <Input
                        id="cartao_info"
                        placeholder="Ex: Visa Edney, Nubank Sócio..."
                        value={cartaoInfo}
                        onChange={(e) => setCartaoInfo(e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Serão criadas {numParcelas} parcelas mensais, cada uma como conta separada.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isPending || (recorrente && !frequencia)}
              >
                {isPending
                  ? 'Salvando...'
                  : conta
                    ? 'Salvar alterações'
                    : cartao
                      ? `Criar ${numParcelas}x no cartão`
                      : recorrente
                        ? 'Criar parcelas'
                        : 'Criar conta'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Inline dialog: cadastrar novo fornecedor sem sair do fluxo */}
      <Dialog
        open={novoFornOpen}
        onOpenChange={(v) => { if (!isPendingNovoForn) setNovoFornOpen(v) }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo Fornecedor</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleNovoFornSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="novo-nome">
                Nome <span className="text-destructive">*</span>
              </Label>
              <Input
                id="novo-nome"
                required
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Nome do fornecedor"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="novo-telefone">Telefone / WhatsApp</Label>
              <Input
                id="novo-telefone"
                value={novoTelefone}
                onChange={(e) => setNovoTelefone(e.target.value)}
                placeholder="+55 11 99999-9999"
              />
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-3 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <QrCode className="size-4 text-muted-foreground" />
                <p className="text-sm font-medium">Chave PIX (opcional)</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Tipo</Label>
                  <Select
                    value={novoPixTipo}
                    onValueChange={(v) => { setNovoPixTipo(v ?? ''); setNovoPixChave('') }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {PIX_TIPOS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Chave</Label>
                  <Input
                    value={novoPixChave}
                    onChange={(e) => setNovoPixChave(e.target.value)}
                    disabled={!novoPixTipo}
                    placeholder={PIX_TIPOS.find((t) => t.value === novoPixTipo)?.placeholder ?? '—'}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => setNovoFornOpen(false)}
                disabled={isPendingNovoForn}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPendingNovoForn}>
                {isPendingNovoForn ? 'Cadastrando...' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
