'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, History, Pencil, Trash2, Send, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { salvarParceiroDoContrato } from '@/app/(crm)/parceiros/actions'
import { salvarContratoGerado, excluirContratoGerado, enviarParaAssinatura } from '@/app/(crm)/contratos/actions'
import type { ContratoGerado } from '@/app/(crm)/contratos/actions'
import { StatusBadge } from '@/components/ui/status-badge'

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

export function ContratosView({
  templateUrl,
  emRevisao = false,
  historico: historicoProp = [],
}: {
  templateUrl?: string | null
  emRevisao?: boolean
  historico?: ContratoGerado[]
}) {
  const router = useRouter()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [activeTab, setActiveTab] = useState<'gerador' | 'historico'>('gerador')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [enviandoId, setEnviandoId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

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
      {/* Tabs */}
      <div className="shrink-0 border-b border-border bg-background px-6 pt-3">
        <div className="flex gap-1">
          {(['gerador', 'historico'] as const).map((tab) => (
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
              {tab === 'gerador' ? <FileText className="size-3.5" /> : <History className="size-3.5" />}
              {tab === 'gerador'
                ? 'Gerador'
                : `Histórico${historicoProp.length > 0 ? ` (${historicoProp.length})` : ''}`}
            </button>
          ))}
        </div>
      </div>

      {/* Gerador — mantém montado para receber postMessage de re-edição */}
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        className={`h-full w-full flex-1 border-0 ${activeTab === 'gerador' ? '' : 'hidden'}`}
        title="Gerador de Contratos"
      />

      {/* Histórico */}
      {activeTab === 'historico' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Histórico de contratos gerados</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">Registros salvos no banco de dados</p>
              </div>
            </div>

            {historicoProp.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
                <History className="mb-3 size-10 text-muted-foreground/40" />
                <p className="font-medium text-muted-foreground">Nenhum contrato gerado ainda</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {historicoProp.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">{item.parceiro_nome ?? '—'}</span>
                    </div>
                    <div className="ml-3 flex shrink-0 items-center gap-2.5">
                      <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium">
                        {item.tipo}
                      </span>
                      <StatusBadge variant={STATUS_VARIANT[statusEfetivo(item)]}>
                        {STATUS_LABEL[statusEfetivo(item)]}
                      </StatusBadge>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(item.created_at)}
                      </span>
                      {statusEfetivo(item) === 'rascunho' && (
                        <button
                          type="button"
                          title="Envia o link de assinatura por e-mail para cada signatário do contrato"
                          disabled={enviandoId === item.id}
                          onClick={() => enviarAssinatura(item.id)}
                          className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                        >
                          <Send className="size-3" />
                          {enviandoId === item.id ? 'Enviando…' : 'Enviar p/ assinatura'}
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
                      <button
                        type="button"
                        title="Re-editar"
                        onClick={() => reEditarContrato(item)}
                        className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                      >
                        <Pencil className="size-3" />
                        Re-editar
                      </button>
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
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
