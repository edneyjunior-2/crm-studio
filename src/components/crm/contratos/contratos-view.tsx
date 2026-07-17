'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, History, Pencil, Trash2, Send, ExternalLink, AlertTriangle, PenLine, Upload, Plus, X, Lock, ChevronDown, ChevronUp, Mail, Check } from 'lucide-react'
import { toast } from 'sonner'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { salvarParceiroDoContrato } from '@/app/(crm)/parceiros/actions'
import {
  salvarContratoGerado,
  excluirContratoGerado,
  enviarParaAssinatura,
  listarSignatariosParaEdicao,
  salvarEmailsSignatarios,
} from '@/app/(crm)/contratos/actions'
import type { ContratoGerado } from '@/app/(crm)/contratos/actions'
import { createClient } from '@/lib/supabase/client'
import { StatusBadge } from '@/components/ui/status-badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { salvarSignatarioContratos, contratarAddon } from '@/app/(crm)/configuracoes/actions'
import { ADDON_ASSINATURA } from '@/lib/addons'

function formatDateTime(iso: string) {
  const d = new Date(iso)
  const dd   = String(d.getDate()).padStart(2, '0')
  const mm   = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh   = String(d.getHours()).padStart(2, '0')
  const min  = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} às ${hh}:${min}`
}

// Migration pode ainda não estar aplicada em dev (colunas ausentes do select
// nem chegam a existir) — trata ausência de `status` como 'rascunho', o
// default da coluna quando ela existir.
function statusEfetivo(item: ContratoGerado): 'rascunho' | 'enviado' | 'assinado' | 'recusado' {
  return item.status ?? 'rascunho'
}

// Reusa as variantes já existentes do StatusBadge central (não cria variante
// nova) — mapeamento semântico: rascunho~pendente, enviado~aguardando,
// assinado~pago (verde), recusado~atrasado (vermelho).
const STATUS_VARIANT: Record<string, string> = {
  rascunho: 'pendente',
  enviado:  'aguardando',
  assinado: 'pago',
  recusado: 'atrasado',
}
const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho',
  enviado:  'Enviado',
  assinado: 'Assinado',
  recusado: 'Recusado',
}

// Status do ZapSign por signatário ("new"|"link-opened"|"signed") → rótulo em
// PT-BR + cor. "new"/"link-opened" contam como "ainda não assinou" pro resumo.
const SIGNATARIO_STATUS_LABEL: Record<string, { label: string; className: string }> = {
  new:           { label: 'Aguardando',  className: 'text-muted-foreground' },
  'link-opened': { label: 'Visualizou',  className: 'text-blue-600 dark:text-blue-400' },
  signed:        { label: 'Assinado',    className: 'text-emerald-600 dark:text-emerald-400' },
}

/**
 * Painel "quem assinou / quem falta" — expansível, dentro do card do
 * histórico. Lê `signatarios_zapsign` (nome/e-mail confirmados pelo ZapSign +
 * status individual, sincronizado a cada evento do webhook — ver
 * src/app/api/webhooks/zapsign/route.ts). Mostra o e-mail de cada um de
 * propósito: é o jeito de conferir se o contrato foi mandado pro endereço
 * certo sem precisar abrir o painel do ZapSign.
 */
function PainelSignatarios({ signatarios }: { signatarios: NonNullable<ContratoGerado['signatarios_zapsign']> }) {
  const assinaram = signatarios.filter((s) => s.status === 'signed').length
  const faltam = signatarios.filter((s) => s.status !== 'signed')
  // Aberto por padrão quando falta gente assinar — o resumo colapsado sozinho
  // não bastava (era preciso expandir pra saber quem falta); ver spec
  // contratos-historico-live.md.
  const [aberto, setAberto] = useState(assinaram < signatarios.length)

  return (
    <div className="border-t border-border pt-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {aberto ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          {assinaram}/{signatarios.length} assinaram
        </button>
        {/* Indicador sempre visível (fora do accordion) — mesma paleta âmbar do
            aviso !assinaturaConfigurada logo acima neste arquivo. */}
        {faltam.length > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="size-3 shrink-0" />
            Faltam {faltam.length}: {faltam.slice(0, 2).map((s) => s.nome || s.email || '—').join(', ')}
            {faltam.length > 2 ? ` e mais ${faltam.length - 2}` : ''}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <Check className="size-3 shrink-0" />
            Todos assinaram
          </span>
        )}
      </div>
      {aberto && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {signatarios.map((s, i) => {
            const info = SIGNATARIO_STATUS_LABEL[s.status] ?? SIGNATARIO_STATUS_LABEL.new
            return (
              <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                {s.status === 'signed' ? (
                  <Check className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Mail className="size-3 shrink-0 text-muted-foreground" />
                )}
                <span className="font-medium">{s.nome || '—'}</span>
                {s.email && <span className="text-muted-foreground">{s.email}</span>}
                <span className={`ml-auto font-medium ${info.className}`}>{info.label}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// Toast de sucesso, listando quem recebeu o link. Cada signatário (contraparte,
// responsáveis adicionais e quem assina pela empresa) recebe o SEU link
// individual por e-mail — ver `send_automatic_email` em src/lib/zapsign.ts.
function toastEnviado(signatarios?: string[]) {
  if (signatarios?.length) {
    toast.success(`Enviado para assinatura — link por e-mail para: ${signatarios.join(', ')}`)
  } else {
    toast.success('Enviado para assinatura — cada signatário recebeu o link por e-mail')
  }
}

/**
 * Cadastro de quem assina os contratos EM NOME DA EMPRESA. Fica aqui, dentro do
 * módulo de Contratos, e não em /configuracoes de propósito: aquela página é
 * admin-only (redireciona sócio), e a regra é que admin OU sócio possa cadastrar.
 */
function SignatarioEmpresaDialog({
  open,
  onOpenChange,
  nomeAtual,
  emailAtual,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  nomeAtual: string
  emailAtual: string
}) {
  const router = useRouter()
  const [nome, setNome]   = useState(nomeAtual)
  const [email, setEmail] = useState(emailAtual)
  const [salvando, startSalvar] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    startSalvar(async () => {
      const res = await salvarSignatarioContratos({ nome, email })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success('Responsável pela assinatura salvo')
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Quem assina pela empresa</DialogTitle>
          <DialogDescription>
            O contrato tem assinatura dos dois lados. Esta pessoa entra como signatária em todo
            contrato enviado e recebe o próprio link de assinatura por e-mail.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sig_nome">
              Nome completo <span className="text-destructive">*</span>
            </Label>
            <Input
              id="sig_nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Maria Souza"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sig_email">
              E-mail <span className="text-destructive">*</span>
            </Label>
            <Input
              id="sig_email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="maria@empresa.com.br"
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Edição dos e-mails dos signatários de um contrato do histórico — útil pra
 * corrigir um e-mail digitado errado antes de reenviar (o botão "Reenviar p/
 * assinatura" fica logo ao lado no card). O nome NÃO é editável aqui: é o
 * nome que já está no PDF, mudar aqui não muda o documento gerado. Segue o
 * MESMO padrão de `SignatarioEmpresaDialog` acima — uma ÚNICA instância do
 * dialog, controlada por estado no componente pai (ContratosView), fora do
 * `.map()` do histórico.
 */
function EditarEmailsDialog({
  open,
  onOpenChange,
  contratoId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  contratoId: string | null
}) {
  const router = useRouter()
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [signatarios, setSignatarios] = useState<Array<{ chave: string; nome: string; email: string }>>([])
  const [salvando, startSalvar] = useTransition()

  useEffect(() => {
    if (!open || !contratoId) return
    setCarregando(true)
    setErro(null)
    setSignatarios([])
    listarSignatariosParaEdicao(contratoId).then((res) => {
      setCarregando(false)
      if (res.error) {
        setErro(res.error)
        return
      }
      setSignatarios(res.signatarios ?? [])
    })
  }, [open, contratoId])

  function setEmail(chave: string, email: string) {
    setSignatarios((prev) => prev.map((s) => (s.chave === chave ? { ...s, email } : s)))
  }

  function handleSalvar() {
    if (!contratoId) return
    startSalvar(async () => {
      const alteracoes = signatarios.map((s) => ({ chave: s.chave, email: s.email }))
      const res = await salvarEmailsSignatarios(contratoId, alteracoes)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success('E-mails atualizados')
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar e-mails dos signatários</DialogTitle>
          <DialogDescription>
            O nome vem do documento e não muda por aqui — só o e-mail para onde vai o link de assinatura.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-1">
          {carregando ? (
            <p className="text-sm text-muted-foreground">Carregando signatários…</p>
          ) : erro ? (
            <p className="text-sm text-destructive">{erro}</p>
          ) : (
            signatarios.map((s) => (
              <div key={s.chave} className="flex flex-col gap-1.5">
                <Label htmlFor={`email_${s.chave}`}>{s.nome}</Label>
                <Input
                  id={`email_${s.chave}`}
                  type="email"
                  value={s.email}
                  onChange={(e) => setEmail(s.chave, e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </div>
            ))
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSalvar}
              disabled={salvando || carregando || signatarios.length === 0}
            >
              {salvando ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Aba "Enviar documento": sobe um PDF pronto (feito fora do gerador) e manda
 * pra assinatura via ZapSign. Signatários são informados manualmente (não há
 * como derivar do PDF). Pré-preenche a 1ª linha com quem assina pela empresa,
 * se configurado — mas aqui a lista é 100% editável (o usuário monta tudo).
 */
function UploadDocumentoTab({
  signatarioNome,
  signatarioEmail,
  onEnviado,
}: {
  signatarioNome: string
  signatarioEmail: string
  onEnviado: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [nome, setNome] = useState('')
  const [signatarios, setSignatarios] = useState<Array<{ nome: string; email: string }>>(
    signatarioNome && signatarioEmail
      ? [{ nome: signatarioNome, email: signatarioEmail }, { nome: '', email: '' }]
      : [{ nome: '', email: '' }],
  )
  const [enviando, setEnviando] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    if (f && !nome) setNome(f.name.replace(/\.pdf$/i, ''))
  }

  function setSig(i: number, campo: 'nome' | 'email', valor: string) {
    setSignatarios((prev) => prev.map((s, idx) => (idx === i ? { ...s, [campo]: valor } : s)))
  }
  function addSig() {
    setSignatarios((prev) => [...prev, { nome: '', email: '' }])
  }
  function removeSig(i: number) {
    setSignatarios((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!file) {
      toast.error('Selecione um arquivo PDF.')
      return
    }
    const validos = signatarios
      .map((s) => ({ nome: s.nome.trim(), email: s.email.trim() }))
      .filter((s) => s.nome || s.email)
    if (validos.length === 0) {
      toast.error('Informe ao menos um signatário.')
      return
    }

    const fd = new FormData()
    fd.append('pdf', file)
    fd.append('nome', nome.trim())
    fd.append('signatarios', JSON.stringify(validos))

    setEnviando(true)
    try {
      const res = await fetch('/api/contratos/upload-assinatura', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error ?? 'Não foi possível enviar o documento.')
        return
      }
      toastEnviado(data?.signatarios)
      setFile(null)
      setNome('')
      setSignatarios(
        signatarioNome && signatarioEmail
          ? [{ nome: signatarioNome, email: signatarioEmail }, { nome: '', email: '' }]
          : [{ nome: '', email: '' }],
      )
      if (fileRef.current) fileRef.current.value = ''
      onEnviado()
    } catch {
      toast.error('Falha de conexão ao enviar o documento.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <form onSubmit={handleSubmit} className="mx-auto flex max-w-2xl flex-col gap-5">
        <div>
          <h3 className="font-semibold">Enviar documento para assinatura</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Suba um PDF já pronto (feito fora do gerador) e envie para assinatura eletrônica.
            Cada signatário recebe o próprio link por e-mail.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="upload_pdf">Arquivo PDF (máx. 8 MB)</Label>
          <input
            id="upload_pdf"
            ref={fileRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={onFile}
            className="text-sm text-foreground file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-foreground/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground hover:file:bg-foreground/15"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="upload_nome">Nome do documento</Label>
          <Input
            id="upload_nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Contrato de Parceria Aurum × Contas"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Signatários</Label>
          <p className="-mt-1 text-xs text-muted-foreground">
            Todos que assinam o documento — incluindo quem assina pela sua empresa. Cada um recebe o link no próprio e-mail.
          </p>
          {signatarios.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={s.nome}
                onChange={(e) => setSig(i, 'nome', e.target.value)}
                placeholder="Nome completo"
                className="flex-1"
              />
              <Input
                type="email"
                value={s.email}
                onChange={(e) => setSig(i, 'email', e.target.value)}
                placeholder="email@exemplo.com"
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => removeSig(i)}
                disabled={signatarios.length === 1}
                title="Remover signatário"
                className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-destructive disabled:opacity-40"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addSig}
            className="flex w-fit items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent"
          >
            <Plus className="size-3" />
            Adicionar signatário
          </button>
        </div>

        <div className="flex justify-end pt-1">
          <Button type="submit" disabled={enviando}>
            {enviando ? 'Enviando…' : 'Enviar para assinatura'}
          </Button>
        </div>
      </form>
    </div>
  )
}

export function ContratosView({
  templateUrl,
  emRevisao = false,
  historico: historicoProp = [],
  assinaturaConfigurada = false,
  podeConfigurarAssinatura = false,
  signatarioNome = '',
  signatarioEmail = '',
  temAssinaturaEletronica = false,
  empresaId,
}: {
  templateUrl?: string | null
  emRevisao?: boolean
  historico?: ContratoGerado[]
  /** Empresa já cadastrou quem assina os contratos por ela. Sem isso, o envio
   *  para assinatura eletrônica é bloqueado no servidor (ver enviarParaAssinatura). */
  assinaturaConfigurada?: boolean
  /** Só admin/sócio consegue cadastrar — pros demais, o aviso não oferece a ação. */
  podeConfigurarAssinatura?: boolean
  signatarioNome?: string
  signatarioEmail?: string
  /** Empresa contratou o add-on de assinatura eletrônica (R$49/mês). Sem isso,
   *  tanto o envio do histórico quanto a aba "Enviar documento" viram CTA de
   *  upsell (mesmo padrão de assinaturaConfigurada) — o bloqueio real é no
   *  servidor (enviarParaAssinatura e a rota de upload), isto é só a UI. */
  temAssinaturaEletronica?: boolean
  /** Empresa do usuário logado — usada só para filtrar/assinar o canal Realtime
   *  (defesa em profundidade; a RLS de SELECT em contratos_gerados já isola por
   *  empresa_id). Sem empresaId (conta órfã), o canal simplesmente não assina. */
  empresaId?: string | null
}) {
  const router = useRouter()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [activeTab, setActiveTab] = useState<'gerador' | 'upload' | 'historico'>('gerador')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [enviandoId, setEnviandoId] = useState<string | null>(null)
  const [signatarioOpen, setSignatarioOpen] = useState(false)
  const [editandoEmailId, setEditandoEmailId] = useState<string | null>(null)
  const [comprandoAddon, setComprandoAddon] = useState(false)
  const [, startTransition] = useTransition()

  // Estado local do histórico: começa a partir da prop (fetch único no
  // server), mas passa a ser atualizado também pelo Realtime (assinatura
  // abaixo) e resincronizado quando a prop mudar (ex.: router.refresh() após
  // excluir/enviarAssinatura/upload).
  const [historico, setHistorico] = useState<ContratoGerado[]>(historicoProp)
  useEffect(() => {
    setHistorico(historicoProp)
  }, [historicoProp])

  // Realtime: mantém o Histórico atualizado sem F5 quando o webhook do
  // ZapSign grava mudança de status em background (signatário assinou, doc
  // recusado, etc.) — ver spec contratos-historico-live.md. O filtro
  // `empresa_id=eq.${empresaId}` no `.channel()` é defesa em profundidade /
  // eficiência; a RLS de SELECT em contratos_gerados já isola por empresa no
  // banco. Reconexão do canal é responsabilidade do próprio client do
  // Supabase (não reimplementar retry aqui).
  useEffect(() => {
    if (!empresaId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`contratos_gerados_${empresaId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contratos_gerados', filter: `empresa_id=eq.${empresaId}` },
        (payload: RealtimePostgresChangesPayload<ContratoGerado>) => {
          setHistorico((prev) => {
            if (payload.eventType === 'DELETE') {
              const oldId = (payload.old as { id?: string })?.id
              return prev.filter((c) => c.id !== oldId)
            }
            const novo = payload.new as ContratoGerado
            const existe = prev.some((c) => c.id === novo.id)
            if (existe) {
              // Spread por cima do item antigo: preserva campos só-de-join que
              // o payload cru do Realtime NÃO carrega (ex.: enviado_por_nome,
              // que vem de um embed no fetch inicial, não é coluna própria da
              // tabela).
              return prev.map((c) => (c.id === novo.id ? { ...c, ...novo } : c))
            }
            // Nova linha (INSERT) — outra aba/pessoa criou um contrato agora.
            return [novo, ...prev]
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [empresaId])

  // CTA de upsell quando a empresa ainda não tem o add-on (temAssinaturaEletronica
  // === false) — mesmo redirecionamento de continuar-button.tsx (checkout
  // hospedado do Asaas).
  function ativarAssinaturaEletronica() {
    setComprandoAddon(true)
    startTransition(async () => {
      const res = await contratarAddon(ADDON_ASSINATURA)
      if (res.error) {
        toast.error(res.error)
        setComprandoAddon(false)
        return
      }
      if (res.checkoutUrl) window.location.href = res.checkoutUrl
    })
  }

  // Evita cadastrar o mesmo contrato duas vezes se o iframe disparar a mensagem repetida
  const ultimoDoc = useRef<string | null>(null)

  // Origem esperada do iframe. O template pode ser same-origin (/contratos/index.html)
  // OU uma signed URL do Supabase Storage (cross-origin) no white-label — então a
  // origem é derivada do próprio templateUrl, não fixada em window.location.origin.
  const iframeOrigin = useMemo(() => {
    if (typeof window === 'undefined') return ''
    if (!templateUrl) return window.location.origin
    try {
      return new URL(templateUrl, window.location.origin).origin
    } catch {
      return window.location.origin
    }
  }, [templateUrl])

  // Cache-bust via query param — precisa usar URLSearchParams em vez de
  // concatenar "?v=...", pois a signed URL do Supabase Storage (white-label)
  // já vem com "?token=..."; um "?" literal extra corrompe a assinatura do
  // JWT (o token vira "...assinatura?v=20260626", que falha no base64url
  // decode do lado do Storage) e o gerador quebra pra qualquer tenant que
  // não seja o fallback legado same-origin.
  const iframeSrc = useMemo(() => {
    if (!templateUrl) return ''
    if (typeof window === 'undefined') return templateUrl
    try {
      const u = new URL(templateUrl, window.location.origin)
      u.searchParams.set('v', '20260626')
      return u.toString()
    } catch {
      return templateUrl
    }
  }, [templateUrl])

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      // Segurança: a garantia forte é a mensagem vir do NOSSO iframe (source);
      // a origem é validada contra a origem real do template.
      if (e.source !== iframeRef.current?.contentWindow) return
      if (iframeOrigin && e.origin !== iframeOrigin) return
      if (e.data?.type !== 'aurum_contrato_gerado') return

      const p = e.data?.parceiro as { mode?: string; fields?: Record<string, string> } | undefined
      if (!p?.mode || !p?.fields) return

      // Dedup de mensagem repetida
      const doc   = p.mode === 'pf' ? p.fields.PF_CPF : p.fields.PARCEIRO_CNPJ
      const chave = `${p.mode}:${doc || p.fields.PF_NOME || p.fields.PARCEIRO_RAZAO || ''}`
      if (chave === ultimoDoc.current) return
      ultimoDoc.current = chave

      startTransition(async () => {
        // 1. Cadastro automático do parceiro
        const resParceiro = await salvarParceiroDoContrato({
          mode: p.mode as 'pf' | 'pj',
          fields: p.fields!,
        })
        if (resParceiro.error) {
          toast.error(`Não foi possível cadastrar o parceiro: ${resParceiro.error}`)
        } else {
          toast.success(
            resParceiro.created
              ? `Parceiro "${resParceiro.nome}" cadastrado automaticamente`
              : `Parceiro "${resParceiro.nome}" atualizado a partir do contrato`,
          )
        }

        // 2. Persistir contrato no banco
        const tipo: 'PF' | 'PJ' = p.mode === 'pf' ? 'PF' : 'PJ'
        const parceiro_nome = tipo === 'PF'
          ? (p.fields!.PF_NOME ?? null)
          : (p.fields!.PARCEIRO_RAZAO ?? null)
        const parceiro_doc = tipo === 'PF'
          ? (p.fields!.PF_CPF ?? null)
          : (p.fields!.PARCEIRO_CNPJ ?? null)

        const pdfBase64 = typeof e.data.pdfBase64 === 'string' ? e.data.pdfBase64 : undefined
        const pdfFileName = typeof e.data.pdfFileName === 'string' ? e.data.pdfFileName : undefined

        const resContrato = await salvarContratoGerado({
          parceiro_nome,
          parceiro_doc,
          tipo,
          dados: e.data.parceiro,
          pdfBase64,
          pdfFileName,
        })
        if (resContrato.error) {
          toast.error(`Não foi possível salvar o contrato: ${resContrato.error}`)
          router.refresh()
          return
        }
        if (resContrato.avisoUpload) toast.warning(resContrato.avisoUpload)

        // Botão "Assinatura eletrônica" do gerador (ver engine.js,
        // atualizarEstadoBtnDocusign/histAdd): pede pra já disparar o envio
        // pra assinatura assim que o contrato terminar de salvar, sem passar
        // pela aba Histórico. Só dispara se o upload do PDF deu certo
        // (resContrato.avisoUpload ausente) — sem PDF no Storage não tem o
        // que enviar pro ZapSign. Quem assina sai do próprio contrato salvo
        // (ver extrairSignatariosDaContraparte no actions.ts), não de um campo
        // digitado à parte.
        if (e.data?.autoEnviarAssinatura === true && resContrato.id && !resContrato.avisoUpload) {
          const resAssinatura = await enviarParaAssinatura(resContrato.id)
          if (resAssinatura.error) {
            toast.error(resAssinatura.error)
          } else {
            toastEnviado(resAssinatura.signatarios)
          }
        } else {
          toast.success('Contrato salvo no histórico')
        }
        router.refresh()
      })
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [startTransition, router, iframeOrigin])

  function reEditarContrato(item: ContratoGerado) {
    setActiveTab('gerador')
    // Aguarda o iframe montar antes de enviar a mensagem
    setTimeout(() => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'contrato_carregar', dados: item.dados },
        iframeOrigin || window.location.origin,
      )
    }, 300)
  }

  function excluir(id: string) {
    setDeletingId(id)
    startTransition(async () => {
      const res = await excluirContratoGerado(id)
      setDeletingId(null)
      if (res.error) {
        toast.error(`Não foi possível excluir: ${res.error}`)
      } else {
        toast.success('Contrato excluído')
        router.refresh()
      }
    })
  }

  // Envio pela lista do Histórico (o gerador tem o próprio botão, que envia
  // no mesmo passo da geração). Não pede nada: os signatários saem do próprio
  // contrato salvo + do signatário da empresa configurado no admin — se faltar
  // e-mail de alguém, a action devolve um erro dizendo de quem.
  function enviarAssinatura(id: string) {
    setEnviandoId(id)
    startTransition(async () => {
      const res = await enviarParaAssinatura(id)
      setEnviandoId(null)
      if (res.error) {
        toast.error(res.error)
      } else {
        toastEnviado(res.signatarios)
        router.refresh()
      }
    })
  }

  // Sem template configurado para esta empresa → estado vazio
  if (!templateUrl) {
    const titulo    = emRevisao ? 'Modelo em revisão' : 'Gerador de contratos em retrabalho'
    const descricao = emRevisao
      ? 'Seu modelo de contrato foi recebido e está sendo conferido. Em breve ele será liberado e aparecerá aqui.'
      : 'Estamos reconstruindo o gerador de contratos para ser white-label: com a sua marca, os seus modelos e os seus dados. Em breve por aqui.'
    const badge = emRevisao ? 'Em revisão' : 'Em breve'

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
          <FileText className="size-7" />
        </div>
        <h2 className="mt-5 text-2xl font-bold tracking-[-0.01em]">{titulo}</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {descricao}
        </p>
        <span className="mt-5 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
          {badge}
        </span>
      </div>
    )
  }

  return (
    <div className="-m-6 flex h-[calc(100vh-56px)] flex-col">
      {/* Assinatura eletrônica bloqueada até cadastrar quem assina pela empresa */}
      {!assinaturaConfigurada && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-amber-200 bg-amber-50 px-6 py-2.5 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="size-3.5 shrink-0" />
          <span>
            <strong className="font-semibold">Assinatura eletrônica indisponível:</strong>{' '}
            cadastre quem assina os contratos pela empresa. Gerar e baixar o PDF continua funcionando.
          </span>
          {podeConfigurarAssinatura ? (
            <button
              type="button"
              onClick={() => setSignatarioOpen(true)}
              className="font-semibold underline underline-offset-2"
            >
              Cadastrar agora
            </button>
          ) : (
            <span className="opacity-80">Peça a um admin ou sócio para cadastrar.</span>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="shrink-0 border-b border-border bg-background px-6 pt-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {(['gerador', 'upload', 'historico'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'gerador' ? <FileText className="size-3.5" /> : tab === 'upload' ? <Upload className="size-3.5" /> : <History className="size-3.5" />}
                {tab === 'gerador'
                  ? 'Gerador'
                  : tab === 'upload'
                  ? 'Enviar documento'
                  : `Histórico${historico.length > 0 ? ` (${historico.length})` : ''}`}
              </button>
            ))}
          </div>

          {podeConfigurarAssinatura && assinaturaConfigurada && (
            <button
              type="button"
              onClick={() => setSignatarioOpen(true)}
              title={`Assina pela empresa: ${signatarioNome} (${signatarioEmail})`}
              className="mb-1 flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <PenLine className="size-3" />
              <span className="max-w-[14rem] truncate">Assina: {signatarioNome}</span>
            </button>
          )}
        </div>
      </div>

      {/* Gerador — mantém montado para receber postMessage de re-edição */}
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        className={`h-full w-full flex-1 border-0 ${activeTab === 'gerador' ? '' : 'hidden'}`}
        title="Gerador de Contratos"
      />

      {/* Enviar documento (upload de PDF pronto) — bloqueado sem o add-on de
          assinatura eletrônica. O bloqueio real é no servidor (a rota
          /api/contratos/upload-assinatura também checa temAddon); isto é só
          pra não deixar a pessoa preencher o formulário inteiro pra descobrir
          o bloqueio só no submit. */}
      {activeTab === 'upload' && (
        temAssinaturaEletronica ? (
          <UploadDocumentoTab
            signatarioNome={signatarioNome}
            signatarioEmail={signatarioEmail}
            onEnviado={() => { setActiveTab('historico'); router.refresh() }}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Lock className="size-7" />
            </div>
            <h2 className="mt-5 text-xl font-bold tracking-[-0.01em]">Assinatura eletrônica é um módulo adicional</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Envie documentos prontos para assinatura digital com validade jurídica, direto do CRM.
              <strong className="text-foreground"> R$ 49/mês.</strong>
            </p>
            {podeConfigurarAssinatura ? (
              <button
                type="button"
                onClick={ativarAssinaturaEletronica}
                disabled={comprandoAddon}
                className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {comprandoAddon ? 'Abrindo checkout…' : 'Ativar agora'}
              </button>
            ) : (
              <span className="mt-5 text-sm text-muted-foreground">
                Peça ao administrador ou sócio da conta para ativar.
              </span>
            )}
          </div>
        )
      )}

      {/* Histórico */}
      {activeTab === 'historico' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-4xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Histórico de contratos gerados</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">Registros salvos no banco de dados</p>
              </div>
            </div>

            {historico.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
                <History className="mb-3 size-10 text-muted-foreground/40" />
                <p className="font-medium text-muted-foreground">Nenhum contrato gerado ainda</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {historico.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2.5 rounded-lg border border-border bg-card px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate font-medium" title={item.parceiro_nome ?? undefined}>
                        {item.parceiro_nome ?? '—'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium">
                        {item.origem === 'upload' ? 'Documento' : item.tipo}
                      </span>
                      <StatusBadge variant={STATUS_VARIANT[statusEfetivo(item)]}>
                        {STATUS_LABEL[statusEfetivo(item)]}
                      </StatusBadge>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(item.created_at)}
                      </span>
                      {item.enviado_por_nome && (
                        <span className="text-xs text-muted-foreground">Enviado por {item.enviado_por_nome}</span>
                      )}
                      {statusEfetivo(item) !== 'assinado' && (
                        temAssinaturaEletronica ? (
                          // Upload não exige o responsável-empresa (a lista de
                          // signatários é 100% manual, guardada no envio); só o
                          // gerador precisa dele. Por isso o gate por
                          // assinaturaConfigurada só vale para origem !== 'upload'.
                          <button
                            type="button"
                            title={
                              item.origem === 'upload' || assinaturaConfigurada
                                ? 'Envia o link de assinatura por e-mail para cada signatário do contrato'
                                : 'Cadastre quem assina os contratos pela empresa para habilitar'
                            }
                            disabled={enviandoId === item.id || (item.origem !== 'upload' && !assinaturaConfigurada)}
                            onClick={() => enviarAssinatura(item.id)}
                            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Send className="size-3" />
                            {enviandoId === item.id
                              ? 'Enviando…'
                              : statusEfetivo(item) === 'rascunho'
                              ? 'Enviar p/ assinatura'
                              : 'Reenviar p/ assinatura'}
                          </button>
                        ) : podeConfigurarAssinatura ? (
                          <button
                            type="button"
                            title="Módulo adicional — R$ 49/mês"
                            disabled={comprandoAddon}
                            onClick={ativarAssinaturaEletronica}
                            className="flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Lock className="size-3" />
                            {comprandoAddon ? 'Abrindo checkout…' : 'Ativar assinatura eletrônica'}
                          </button>
                        ) : (
                          <span
                            title="Peça a um administrador ou sócio da conta para ativar a assinatura eletrônica"
                            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground"
                          >
                            <Lock className="size-3" />
                            Fale com o administrador
                          </span>
                        )
                      )}
                      {statusEfetivo(item) !== 'assinado' && (
                        <button
                          type="button"
                          title="Editar o e-mail de quem vai assinar"
                          onClick={() => setEditandoEmailId(item.id)}
                          className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                        >
                          <Mail className="size-3" />
                          Editar e-mails
                        </button>
                      )}
                      {statusEfetivo(item) === 'enviado' && item.link_assinatura && (
                        <button
                          type="button"
                          // ATENÇÃO: é o link PESSOAL do 1º signatário (a contraparte principal).
                          // Cada signatário — sócios adicionais e quem assina pela empresa — tem
                          // o SEU próprio link, já enviado por e-mail. Reenviar ESTE link a outra
                          // pessoa faria ela assinar no lugar da contraparte principal. Para
                          // reenviar a um dos demais, usar o painel do ZapSign.
                          title="Link do 1º signatário (contraparte principal) — só para reenviar a ELE, se não recebeu o e-mail. Os demais têm links próprios."
                          onClick={() => window.open(item.link_assinatura!, '_blank', 'noopener')}
                          className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                        >
                          <ExternalLink className="size-3" />
                          Link do 1º signatário
                        </button>
                      )}
                      {item.origem !== 'upload' && (
                        <button
                          type="button"
                          title="Re-editar"
                          onClick={() => reEditarContrato(item)}
                          className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                        >
                          <Pencil className="size-3" />
                          Re-editar
                        </button>
                      )}
                      <button
                        type="button"
                        title="Excluir"
                        disabled={deletingId === item.id}
                        onClick={() => excluir(item.id)}
                        className="flex items-center gap-1 rounded-md border border-destructive/30 px-2 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                      >
                        <Trash2 className="size-3" />
                        {deletingId === item.id ? 'Excluindo…' : 'Excluir'}
                      </button>
                    </div>

                    {item.signatarios_zapsign && item.signatarios_zapsign.length > 0 && (
                      <PainelSignatarios signatarios={item.signatarios_zapsign} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {podeConfigurarAssinatura && (
        <SignatarioEmpresaDialog
          open={signatarioOpen}
          onOpenChange={setSignatarioOpen}
          nomeAtual={signatarioNome}
          emailAtual={signatarioEmail}
        />
      )}

      <EditarEmailsDialog
        open={editandoEmailId !== null}
        onOpenChange={(o) => setEditandoEmailId(o ? editandoEmailId : null)}
        contratoId={editandoEmailId}
      />
    </div>
  )
}
