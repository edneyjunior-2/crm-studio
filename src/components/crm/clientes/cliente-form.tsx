'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Search, Loader2, AlertTriangle, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createCliente, updateCliente, assumirCliente, verificarCnpj, type VerificarCnpjResult } from '@/app/(crm)/clientes/actions'
import type { Cliente } from '@/types'

interface ParceiroOption {
  id: string
  nome: string
  empresa: string | null
}

interface UsuarioOption {
  id: string
  full_name: string
}

interface ClienteFormProps {
  cliente?: Cliente
  /** Elemento que abre o dialog quando clicado (modo uncontrolled). Pode ser omitido quando se usa open/onOpenChange. */
  trigger?: React.ReactNode
  /** Controla o estado de abertura do dialog externamente. */
  open?: boolean
  /** Notifica mudança no estado de abertura quando controlado externamente. */
  onOpenChange?: (open: boolean) => void
  /** Callback chamado após cadastro bem-sucedido com os dados do cliente criado. */
  onSuccess?: (cliente: { id: string; razao_social: string }) => void
}

interface CnpjWsResponse {
  razao_social?: string
  socios?: { nome?: string }[]
  estabelecimento?: {
    atividade_principal?: { id: string; descricao: string }
  }
  // formatos legados (fallback)
  atividade_principal?: { code: string; text: string }[]
  qsa?: { nome_socio?: string }[]
}

function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
}

function formatTelefone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
  }
  return digits
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
}

export function ClienteForm({ cliente, trigger, open: openProp, onOpenChange: onOpenChangeProp, onSuccess }: ClienteFormProps) {
  const [openInternal, setOpenInternal] = useState(false)

  // Modo controlado externamente se openProp for fornecido
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : openInternal
  const setOpen = (value: boolean) => {
    if (!isControlled) setOpenInternal(value)
    onOpenChangeProp?.(value)
  }
  const [isPending, startTransition] = useTransition()
  const [isBuscandoCnpj, setIsBuscandoCnpj] = useState(false)
  const [isVerificandoCnpj, setIsVerificandoCnpj] = useState(false)

  const [tipoPessoa, setTipoPessoa] = useState<'pj' | 'pf'>(cliente?.tipo_pessoa ?? 'pj')
  const [cnpj, setCnpj] = useState(cliente?.cnpj ?? '')
  const [cpf, setCpf] = useState(cliente?.cpf ?? '')
  const [telefone, setTelefone] = useState(cliente?.contato_telefone ?? '')
  const [razaoSocial, setRazaoSocial] = useState(cliente?.razao_social ?? '')
  const [segmento, setSegmento] = useState(cliente?.segmento ?? '')
  const [email, setEmail] = useState(cliente?.contato_email ?? '')
  const [contatoNome, setContatoNome] = useState(cliente?.contato_nome ?? '')
  const [areaTipo, setAreaTipo] = useState<'publica' | 'privada'>('publica')
  const [bloqueioAtivo, setBloqueioAtivo] = useState<boolean>(cliente?.bloqueio_exclusividade ?? true)

  // Estado de verificação de CNPJ
  const [cnpjStatus, setCnpjStatus] = useState<VerificarCnpjResult | null>(null)
  const verificacaoCnpjRef = useRef<string>('')

  // Rastreia quais campos foram editados manualmente pelo usuário
  const manuallyEdited = useRef<Set<string>>(new Set())

  const [origemTipo, setOrigemTipo] = useState<string | null>(cliente?.origem_tipo ?? null)
  const [parceiroId, setParceiroId] = useState<string | null>(cliente?.parceiro_id ?? null)
  const [indicadoPor, setIndicadoPor] = useState<string | null>(cliente?.indicado_por ?? null)
  const [parceiros, setParceiros] = useState<ParceiroOption[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioOption[]>([])
  const [isLoadingParceiros, setIsLoadingParceiros] = useState(false)
  const [isLoadingUsuarios, setIsLoadingUsuarios] = useState(false)

  const isEdicao = !!cliente

  useEffect(() => {
    if (origemTipo === 'parceiro' && parceiros.length === 0) {
      setIsLoadingParceiros(true)
      fetch('/api/parceiros')
        .then((r) => r.json())
        .then((data: ParceiroOption[]) => setParceiros(data))
        .catch(() => toast.error('Erro ao carregar parceiros.'))
        .finally(() => setIsLoadingParceiros(false))
    }
    if (origemTipo === 'indicacao_interna' && usuarios.length === 0) {
      setIsLoadingUsuarios(true)
      fetch('/api/usuarios')
        .then((r) => r.json())
        .then((data: UsuarioOption[]) => setUsuarios(data))
        .catch(() => toast.error('Erro ao carregar usuários.'))
        .finally(() => setIsLoadingUsuarios(false))
    }
  }, [origemTipo, parceiros.length, usuarios.length])

  // Verificar duplicidade de CNPJ automaticamente ao completar 14 dígitos (apenas no cadastro)
  useEffect(() => {
    if (tipoPessoa !== 'pj') return
    if (isEdicao) return

    const digits = cnpj.replace(/\D/g, '')
    if (digits.length !== 14) {
      setCnpjStatus(null)
      return
    }

    // Evitar verificar o mesmo CNPJ duas vezes
    if (verificacaoCnpjRef.current === digits) return
    verificacaoCnpjRef.current = digits

    setIsVerificandoCnpj(true)
    verificarCnpj(cnpj)
      .then((result) => setCnpjStatus(result))
      .catch(() => setCnpjStatus({ status: 'erro', message: 'Erro ao verificar CNPJ.' }))
      .finally(() => setIsVerificandoCnpj(false))
  }, [cnpj, isEdicao, tipoPessoa])

  function handleOpenChange(nextOpen: boolean) {
    if (!isPending) setOpen(nextOpen)
  }

  function handleOrigemChange(value: string | null) {
    setOrigemTipo(value)
    setParceiroId(null)
    setIndicadoPor(null)
  }

  function markManual(field: string) {
    manuallyEdited.current.add(field)
  }

  async function buscarCnpj() {
    const digits = cnpj.replace(/\D/g, '')
    if (digits.length !== 14) {
      toast.error('Digite um CNPJ completo (14 dígitos) antes de buscar.')
      return
    }

    setIsBuscandoCnpj(true)
    try {
      const res = await fetch(`https://publica.cnpj.ws/cnpj/${digits}`)
      if (!res.ok) {
        toast.error('CNPJ não encontrado ou serviço indisponível. Tente novamente.')
        return
      }
      const data: CnpjWsResponse = await res.json()

      let preenchidos = 0

      if (data.razao_social && !manuallyEdited.current.has('razao_social')) {
        setRazaoSocial(data.razao_social)
        preenchidos++
      }
      const cnaeDescricao =
        data.estabelecimento?.atividade_principal?.descricao ??
        data.atividade_principal?.[0]?.text
      if (cnaeDescricao && !manuallyEdited.current.has('segmento')) {
        setSegmento(cnaeDescricao)
        preenchidos++
      }
      const nomeSocio = data.socios?.[0]?.nome ?? data.qsa?.[0]?.nome_socio
      if (nomeSocio && !manuallyEdited.current.has('contato_nome') && !contatoNome) {
        setContatoNome(nomeSocio)
        preenchidos++
      }

      if (preenchidos > 0) {
        toast.success('Dados preenchidos automaticamente.')
      } else {
        toast.info('Dados da empresa já estão preenchidos manualmente.')
      }
    } catch {
      toast.error('Erro ao consultar o CNPJ. Verifique sua conexão e tente novamente.')
    } finally {
      setIsBuscandoCnpj(false)
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    // Bloquear envio se CNPJ está bloqueado por território (apenas PJ)
    if (tipoPessoa === 'pj' && !isEdicao && cnpjStatus?.status === 'bloqueado') {
      toast.error('Este CNPJ está bloqueado. Aguarde a expiração do período.')
      return
    }

    const form = e.currentTarget
    const formData = new FormData(form)

    formData.set('razao_social', razaoSocial)
    formData.set('segmento', segmento)
    formData.set('contato_nome', contatoNome)
    formData.set('contato_email', email)
    formData.set('contato_telefone', telefone)
    formData.set('tipo_pessoa', tipoPessoa)
    formData.set('cnpj', tipoPessoa === 'pj' ? cnpj : '')
    formData.set('cpf', tipoPessoa === 'pf' ? cpf : '')
    formData.set('origem_tipo', origemTipo ?? '')
    formData.set('parceiro_id', origemTipo === 'parceiro' ? (parceiroId ?? '') : '')
    formData.set('indicado_por', origemTipo === 'indicacao_interna' ? (indicadoPor ?? '') : '')
    formData.set('area_tipo', areaTipo)
    formData.set('bloqueio_exclusividade', String(bloqueioAtivo))

    startTransition(async () => {
      // Se o CNPJ está livre para assumir, chamar assumirCliente em vez de criar novo (apenas PJ)
      if (tipoPessoa === 'pj' && !isEdicao && cnpjStatus?.status === 'livre_para_assumir') {
        const result = await assumirCliente(cnpjStatus.clienteId)
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success('Você assumiu este cliente com sucesso.')
        setOpen(false)
        resetForm(form)
        return
      }

      if (cliente) {
        const result = await updateCliente(cliente.id, formData)
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success('Cliente atualizado com sucesso.')
        setOpen(false)
      } else {
        const result = await createCliente(formData)
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success('Cliente cadastrado com sucesso.')
        setOpen(false)
        resetForm(form)
        if (result.cliente) {
          onSuccess?.(result.cliente)
        }
      }
    })
  }

  function resetForm(form: HTMLFormElement) {
    form.reset()
    setTipoPessoa('pj')
    setCnpj('')
    setCpf('')
    setTelefone('')
    setRazaoSocial('')
    setSegmento('')
    setEmail('')
    setContatoNome('')
    setOrigemTipo(null)
    setParceiroId(null)
    setIndicadoPor(null)
    setCnpjStatus(null)
    setAreaTipo('publica')
    setBloqueioAtivo(true)
    verificacaoCnpjRef.current = ''
    manuallyEdited.current.clear()
  }

  const cnpjDigits = cnpj.replace(/\D/g, '')
  const cnpjCompleto = cnpjDigits.length === 14

  // Definir se o submit é possível (bloqueio só se aplica a PJ)
  const submitBloqueado = tipoPessoa === 'pj' && !isEdicao && cnpjStatus?.status === 'bloqueado'
  const isAssumindo = tipoPessoa === 'pj' && !isEdicao && cnpjStatus?.status === 'livre_para_assumir'

  return (
    <>
      {trigger != null && (
        <span onClick={() => setOpen(true)} style={{ display: 'contents' }}>
          {trigger}
        </span>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {cliente ? 'Editar cliente' : isAssumindo ? 'Assumir cliente' : 'Novo cliente'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto pr-1 pb-1">
            {/* Tipo de pessoa: Jurídica (CNPJ) ou Física (CPF) */}
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium text-foreground">Tipo de pessoa</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTipoPessoa('pj')}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-lg border p-3 text-sm transition-colors ${
                    tipoPessoa === 'pj'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  <span className="font-medium">Pessoa Jurídica</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTipoPessoa('pf')}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-lg border p-3 text-sm transition-colors ${
                    tipoPessoa === 'pf'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  <span className="font-medium">Pessoa Física</span>
                </button>
              </div>
            </div>

            {tipoPessoa === 'pj' ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cnpj">CNPJ</Label>
              <div className="flex gap-2">
                <Input
                  id="cnpj"
                  name="cnpj"
                  value={cnpj}
                  onChange={(e) => {
                    const formatted = formatCnpj(e.target.value)
                    setCnpj(formatted)
                    // Resetar status de verificação ao mudar o CNPJ
                    if (formatted !== cnpj) {
                      setCnpjStatus(null)
                      verificacaoCnpjRef.current = ''
                    }
                  }}
                  placeholder="00.000.000/0000-00"
                  className="flex-1"
                />
                {cnpjCompleto && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={buscarCnpj}
                    disabled={isBuscandoCnpj || isPending}
                    className="shrink-0 gap-1.5"
                  >
                    {isBuscandoCnpj
                      ? <Loader2 className="size-3.5 animate-spin" />
                      : <Search className="size-3.5" />
                    }
                    {isBuscandoCnpj ? 'Buscando...' : 'Buscar dados'}
                  </Button>
                )}
              </div>
              {!cnpjCompleto && !isEdicao && (
                <p className="text-xs text-muted-foreground">
                  Digite o CNPJ completo para habilitar o preenchimento automático.
                </p>
              )}
              {isVerificandoCnpj && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  Verificando disponibilidade...
                </p>
              )}

              {/* Alerta: CNPJ bloqueado por território */}
              {!isEdicao && cnpjStatus?.status === 'bloqueado' && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <div>
                    <p className="font-medium text-destructive">CNPJ indisponível</p>
                    <p className="text-destructive/80">
                      Este CNPJ já está cadastrado na base. Responsável:{' '}
                      <strong>{cnpjStatus.responsavel}</strong>, bloqueio até{' '}
                      <strong>{cnpjStatus.expiracao}</strong>.
                    </p>
                  </div>
                </div>
              )}

              {/* Alerta: CNPJ livre para assumir */}
              {!isEdicao && cnpjStatus?.status === 'livre_para_assumir' && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
                  <Info className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  <div>
                    <p className="font-medium text-amber-800">CNPJ disponível para assumir</p>
                    <p className="text-amber-700">
                      Responsável anterior: <strong>{cnpjStatus.responsavelAnterior}</strong>.
                      Ao salvar, você se tornará o novo responsável por este cliente.
                    </p>
                  </div>
                </div>
              )}
            </div>
            ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                name="cpf"
                value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                placeholder="000.000.000-00"
              />
            </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="razao_social">
                {tipoPessoa === 'pf' ? 'Nome completo' : 'Razão Social'}{' '}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="razao_social"
                name="razao_social"
                required
                value={razaoSocial}
                onChange={(e) => {
                  setRazaoSocial(e.target.value)
                  markManual('razao_social')
                }}
                placeholder={tipoPessoa === 'pf' ? 'Nome da pessoa' : 'Nome da empresa'}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="segmento">Segmento</Label>
              <Textarea
                id="segmento"
                name="segmento"
                value={segmento}
                onChange={(e) => {
                  setSegmento(e.target.value)
                  markManual('segmento')
                  e.target.style.height = 'auto'
                  e.target.style.height = e.target.scrollHeight + 'px'
                }}
                placeholder="Ex: Saúde, Varejo..."
                rows={1}
                className="resize-none overflow-hidden"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contato_nome">Nome do Contato</Label>
              <Input
                id="contato_nome"
                name="contato_nome"
                value={contatoNome}
                onChange={(e) => {
                  setContatoNome(e.target.value)
                  markManual('contato_nome')
                }}
                placeholder="Nome completo"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contato_email">E-mail</Label>
                <Input
                  id="contato_email"
                  name="contato_email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    markManual('email')
                  }}
                  placeholder="email@empresa.com"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contato_telefone">Telefone</Label>
                <Input
                  id="contato_telefone"
                  name="contato_telefone"
                  value={telefone}
                  onChange={(e) => {
                    setTelefone(formatTelefone(e.target.value))
                    markManual('telefone')
                  }}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                name="observacoes"
                defaultValue={cliente?.observacoes ?? ''}
                placeholder="Informações adicionais sobre o cliente..."
                rows={3}
              />
            </div>

            {/* Tipo de Área — apenas no cadastro, não na edição */}
            {!isEdicao && (
              <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-foreground">Bloqueio de exclusividade</p>
                    <p className="text-xs text-muted-foreground">
                      Define o período de exclusividade do responsável pelo cliente.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={bloqueioAtivo}
                    aria-label="Bloqueio de exclusividade"
                    onClick={() => setBloqueioAtivo((v) => !v)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                      bloqueioAtivo ? 'bg-primary' : 'bg-muted-foreground/30'
                    }`}
                  >
                    <span
                      className={`inline-block size-5 rounded-full bg-white shadow-sm transition-transform ${
                        bloqueioAtivo ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
                {bloqueioAtivo ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAreaTipo('publica')}
                      className={`flex flex-1 flex-col items-center gap-1 rounded-lg border p-3 text-sm transition-colors ${
                        areaTipo === 'publica'
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/40'
                      }`}
                    >
                      <span className="font-medium">Pública</span>
                      <span className="text-xs opacity-70">Bloqueio de 90 dias</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAreaTipo('privada')}
                      className={`flex flex-1 flex-col items-center gap-1 rounded-lg border p-3 text-sm transition-colors ${
                        areaTipo === 'privada'
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/40'
                      }`}
                    >
                      <span className="font-medium">Privada</span>
                      <span className="text-xs opacity-70">Bloqueio de 30 dias</span>
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Sem bloqueio de exclusividade — qualquer responsável pode assumir este cliente.
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
              <p className="text-sm font-medium text-foreground">Origem do cliente</p>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="origem_tipo">Tipo de Origem</Label>
                <Select value={origemTipo ?? undefined} onValueChange={handleOrigemChange}>
                  <SelectTrigger id="origem_tipo">
                    {origemTipo ? (
                      <span className="flex flex-1 text-left line-clamp-1">
                        {origemTipo === 'parceiro' ? 'Indicação de Parceiro' : 'Indicação Interna'}
                      </span>
                    ) : (
                      <SelectValue placeholder="Selecione a origem..." />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="parceiro">Indicação de Parceiro</SelectItem>
                    <SelectItem value="indicacao_interna">Indicação Interna</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {origemTipo === 'parceiro' && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="parceiro_id">Parceiro</Label>
                  {isLoadingParceiros ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Carregando parceiros...
                    </div>
                  ) : (
                    <Select value={parceiroId ?? undefined} onValueChange={setParceiroId}>
                      <SelectTrigger id="parceiro_id">
                        {parceiroId ? (
                          <span className="flex flex-1 text-left line-clamp-1">
                            {(() => {
                              const p = parceiros.find(x => x.id === parceiroId)
                              return p ? `${p.nome}${p.empresa ? ` — ${p.empresa}` : ''}` : 'Parceiro não encontrado'
                            })()}
                          </span>
                        ) : (
                          <SelectValue placeholder="Selecione o parceiro..." />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {parceiros.length === 0 ? (
                          <SelectItem value="__empty__" disabled>
                            Nenhum parceiro cadastrado
                          </SelectItem>
                        ) : (
                          parceiros.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nome}{p.empresa ? ` — ${p.empresa}` : ''}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {origemTipo === 'indicacao_interna' && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="indicado_por">Indicado Por</Label>
                  {isLoadingUsuarios ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Carregando usuários...
                    </div>
                  ) : (
                    <Select
                      value={indicadoPor ?? undefined}
                      onValueChange={(v) => setIndicadoPor(v)}
                    >
                      <SelectTrigger id="indicado_por">
                        {indicadoPor ? (
                          <span className="flex flex-1 text-left line-clamp-1">
                            {usuarios.find(u => u.id === indicadoPor)?.full_name ?? 'Usuário sem nome'}
                          </span>
                        ) : (
                          <SelectValue placeholder="Selecione o usuário..." />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {usuarios.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.full_name || 'Usuário sem nome'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </div>
          </div>

            <DialogFooter className="pt-4">
              <DialogClose render={<Button variant="outline" type="button" />}>
                Cancelar
              </DialogClose>
              <Button type="submit" disabled={isPending || submitBloqueado}>
                {isPending
                  ? isAssumindo ? 'Assumindo...' : 'Salvando...'
                  : isAssumindo
                    ? 'Assumir cliente'
                    : cliente
                      ? 'Salvar alterações'
                      : 'Cadastrar cliente'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
