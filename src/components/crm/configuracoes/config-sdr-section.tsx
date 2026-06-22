'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bot, Check, Loader2, Copy, Lightbulb, Sparkles } from 'lucide-react'
import { salvarConfigSdrEmpresa } from '@/app/(crm)/configuracoes/actions'

interface ConfigSdr {
  wa_phone_number_id: string | null
  nome_escritorio:    string | null
  nome_assistente:    string | null
  tom_de_voz:         string | null
  sugestao_sdr?:      string | null
}

const EXEMPLOS_TOM = [
  {
    titulo: 'Acolhedor e consultivo',
    texto: 'Linguagem simples e empática. Primeiro entenda a dor do cliente, depois oriente. Transmita cuidado e segurança. Nunca prometa resultado nem fale valores.',
  },
  {
    titulo: 'Objetivo e profissional',
    texto: 'Direto ao ponto, técnico mas claro. Poucas perguntas, bem escolhidas. Transmite expertise e seriedade. Não promete resultado.',
  },
  {
    titulo: 'Próximo e informal',
    texto: 'Tom de conversa, leve e descontraído (emojis com moderação), mas sempre respeitoso e profissional. Acolhe e conduz com naturalidade.',
  },
]

export function ConfigSdrSection({ config }: { config: ConfigSdr | null }) {
  const router = useRouter()
  const [wa, setWa]                 = useState(config?.wa_phone_number_id ?? '')
  const [escritorio, setEscritorio] = useState(config?.nome_escritorio ?? '')
  const [assistente, setAssistente] = useState(config?.nome_assistente ?? 'Leila')
  const [tom, setTom]               = useState(config?.tom_de_voz ?? '')
  const [erro, setErro]             = useState<string | null>(null)
  const [ok, setOk]                 = useState(false)
  const [salvando, startSalvar]     = useTransition()

  const sugestao = config?.sugestao_sdr ?? null

  const inputClass = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40'

  function salvar() {
    setErro(null); setOk(false)
    const fd = new FormData()
    fd.set('wa_phone_number_id', wa)
    fd.set('nome_escritorio', escritorio)
    fd.set('nome_assistente', assistente)
    fd.set('tom_de_voz', tom)
    startSalvar(async () => {
      const res = await salvarConfigSdrEmpresa(fd)
      if (res.error) { setErro(res.error); return }
      setOk(true)
      setTimeout(() => setOk(false), 2500)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5">
      <div>
        <div className="flex items-center gap-2">
          <Bot className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Agente SDR — persona e tom de voz</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Configure como o agente de IA conversa com os seus leads no WhatsApp.
          Escolha o nome, o tom e o estilo que combinam com a sua empresa.
        </p>
      </div>

      {/* Sugestão de melhoria enviada pelo admin */}
      {sugestao && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
          <div className="flex items-center gap-2">
            <Lightbulb className="size-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-800 dark:text-amber-400">
              Sugestão de melhoria do seu suporte
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm text-amber-900 dark:text-amber-300">{sugestao}</p>
          <button
            type="button"
            onClick={() => setTom(sugestao)}
            className="inline-flex items-center gap-1.5 self-start rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 transition-colors"
          >
            <Sparkles className="size-3.5" />
            Aplicar sugestão no tom de voz
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        {/* Formulário */}
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Número do WhatsApp <span className="text-muted-foreground/60">(phone_number_id da Meta)</span>
              </label>
              <input
                value={wa}
                onChange={(e) => setWa(e.target.value)}
                placeholder="Ex.: 109987… (ou deixe em branco)"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nome da assistente</label>
              <input
                value={assistente}
                onChange={(e) => setAssistente(e.target.value)}
                placeholder="Ex.: Leila, Sofia, Ana…"
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Nome da empresa / escritório</label>
            <input
              value={escritorio}
              onChange={(e) => setEscritorio(e.target.value)}
              placeholder="Como o agente vai se apresentar"
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Tom de voz</label>
            <textarea
              value={tom}
              onChange={(e) => setTom(e.target.value)}
              rows={5}
              placeholder="Descreva como o agente deve se comunicar com os leads…"
              className={inputClass}
            />
          </div>

          {erro && <p className="text-xs text-destructive">{erro}</p>}

          <button
            onClick={salvar}
            disabled={salvando}
            className="inline-flex items-center gap-1.5 self-start rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-60"
          >
            {salvando ? <Loader2 className="size-4 animate-spin" /> : ok ? <Check className="size-4" /> : null}
            {ok ? 'Salvo!' : 'Salvar configuração'}
          </button>
        </div>

        {/* Exemplos de tom de voz */}
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs font-semibold text-foreground">Exemplos de tom de voz</p>
          <p className="text-[11px] text-muted-foreground">Clique para usar como base e ajuste.</p>
          {EXEMPLOS_TOM.map((ex) => (
            <button
              key={ex.titulo}
              type="button"
              onClick={() => setTom(ex.texto)}
              className="flex flex-col gap-1 rounded-lg border border-border bg-background p-2.5 text-left transition-colors hover:border-foreground/30"
            >
              <span className="flex items-center justify-between gap-1 text-xs font-medium text-foreground">
                {ex.titulo}
                <Copy className="size-3 text-muted-foreground" />
              </span>
              <span className="line-clamp-2 text-[11px] text-muted-foreground">{ex.texto}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
