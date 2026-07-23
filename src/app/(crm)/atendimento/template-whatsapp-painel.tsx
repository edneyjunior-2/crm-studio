'use client'

import { useEffect, useState } from 'react'
import { Send, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { sugerirValoresTemplate } from './atendimento-actions'
import type { WhatsAppTemplateInfo } from '@/lib/whatsapp-cloud'

export interface TemplateEscolhido {
  templateName: string
  language: string
  bodyText: string
  variaveis: string[]
}

interface Props {
  templates: WhatsAppTemplateInfo[]
  clienteId: string | undefined
  enviando: boolean
  /** Texto do aviso no topo do painel. Default: aviso preventivo (checagem antes de enviar). */
  aviso?: string
  onCancelar: () => void
  onEnviar: (escolha: TemplateEscolhido) => void
}

/** Substitui {{1}}, {{2}}... no corpo do template pelos valores atuais (preview ao vivo). */
function renderizarPreview(bodyText: string, variaveis: string[]): string {
  return bodyText.replace(/\{\{(\d+)\}\}/g, (match, n: string) => {
    const valor = variaveis[Number(n) - 1]
    return valor?.trim() ? valor : `[${match}]`
  })
}

/**
 * Painel de escolha de template pra reabrir uma conversa fora da janela de
 * 24h — mostra os templates aprovados na Meta (buscados uma vez em
 * atendimento/page.tsx), deixa escolher qual mandar quando há mais de um, e
 * confere as variáveis antes do envio (nunca manda sem o usuário ver o texto
 * final primeiro).
 */
export function TemplateWhatsAppPainel({ templates, clienteId, enviando, aviso, onCancelar, onEnviar }: Props) {
  const [nomeEscolhido, setNomeEscolhido] = useState(templates[0]?.name ?? '')
  const template = templates.find((t) => t.name === nomeEscolhido) ?? templates[0] ?? null

  if (!template) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
        Nenhum modelo de mensagem aprovado foi encontrado na Meta para este número de WhatsApp — confirme no
        Gerenciador de Negócios se existe algum template aprovado.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
      <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
        {aviso ??
          'Esse contato não fala com você há mais de 24h — o WhatsApp exige uma mensagem-modelo para reabrir contato.'}
      </p>

      {templates.length > 1 && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-amber-800 dark:text-amber-300">Modelo</label>
          <select
            value={nomeEscolhido}
            onChange={(e) => setNomeEscolhido(e.target.value)}
            className="rounded-lg border border-amber-300 bg-background px-2.5 py-1.5 text-xs text-foreground outline-none dark:border-amber-800"
          >
            {templates.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* key={template.name} — troca de template remonta com estado fresco em
          vez de sincronizar via efeito (evita reset + fetch competindo). */}
      <CamposTemplate
        key={template.name}
        template={template}
        clienteId={clienteId}
        enviando={enviando}
        onCancelar={onCancelar}
        onEnviar={onEnviar}
      />
    </div>
  )
}

function CamposTemplate({
  template,
  clienteId,
  enviando,
  onCancelar,
  onEnviar,
}: {
  template: WhatsAppTemplateInfo
  clienteId: string | undefined
  enviando: boolean
  onCancelar: () => void
  onEnviar: (escolha: TemplateEscolhido) => void
}) {
  const [variaveis, setVariaveis] = useState<string[]>(() => Array(template.numVariaveis).fill(''))

  useEffect(() => {
    let cancelado = false
    sugerirValoresTemplate(clienteId).then((sugestao) => {
      if (cancelado) return
      setVariaveis(
        Array.from({ length: template.numVariaveis }, (_, i) => {
          if (i === 0) return sugestao.nomeCliente
          if (i === 1) return sugestao.nomeAtendente
          return template.exemplos[i] ?? ''
        }),
      )
    })
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId])

  return (
    <>
      <div className="rounded-md border border-amber-200 bg-background/70 px-2.5 py-2 text-xs italic text-foreground dark:border-amber-900">
        {renderizarPreview(template.bodyText, variaveis)}
      </div>

      {variaveis.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {variaveis.map((valor, i) => (
            <input
              key={i}
              value={valor}
              onChange={(e) =>
                setVariaveis((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))
              }
              placeholder={`Texto para {{${i + 1}}}`}
              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-foreground/40"
            />
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onCancelar} disabled={enviando}>
          <X /> Voltar
        </Button>
        <Button
          size="sm"
          onClick={() =>
            onEnviar({
              templateName: template.name,
              language: template.language,
              bodyText: template.bodyText,
              variaveis,
            })
          }
          disabled={enviando}
        >
          {enviando ? <Loader2 className="animate-spin" /> : <Send />} Enviar modelo
        </Button>
      </div>
    </>
  )
}
