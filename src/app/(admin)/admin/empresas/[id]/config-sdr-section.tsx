'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bot, Check, Loader2, Copy } from 'lucide-react'
import { salvarConfigSdr } from '../actions'

interface ConfigSdr {
  wa_phone_number_id: string | null
  nome_escritorio: string | null
  nome_assistente: string | null
  tom_de_voz: string | null
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

export function ConfigSdrSection({ empresaId, config }: { empresaId: string; config: ConfigSdr | null }) {
  const router = useRouter()
  const [wa, setWa] = useState(config?.wa_phone_number_id ?? '')
  const [escritorio, setEscritorio] = useState(config?.nome_escritorio ?? '')
  const [assistente, setAssistente] = useState(config?.nome_assistente ?? 'Leila')
  const [tom, setTom] = useState(config?.tom_de_voz ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [salvando, startSalvar] = useTransition()

  const inputClass = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40'

  function salvar() {
    setErro(null); setOk(false)
    const fd = new FormData()
    fd.set('wa_phone_number_id', wa)
    fd.set('nome_escritorio', escritorio)
    fd.set('nome_assistente', assistente)
    fd.set('tom_de_voz', tom)
    startSalvar(async () => {
      const res = await salvarConfigSdr(empresaId, fd)
      if (res.error) { setErro(res.error); return }
      setOk(true)
      setTimeout(() => setOk(false), 2500)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div>
        <div className="flex items-center gap-2">
          <Bot className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Configuração do robô (SDR) — persona e tom de voz</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Define como a Leila atende os leads deste cliente. O número (ID da Meta) identifica de quem é a conversa.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        {/* Form */}
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Número do WhatsApp (phone_number_id da Meta)</label>
              <input value={wa} onChange={(e) => setWa(e.target.value)} placeholder="Ex.: 109987... (ou placeholder até a Meta liberar)" className={inputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nome da assistente</label>
              <input value={assistente} onChange={(e) => setAssistente(e.target.value)} placeholder="Leila" className={inputClass} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Nome do escritório / empresa</label>
            <input value={escritorio} onChange={(e) => setEscritorio(e.target.value)} placeholder="Ex.: Saturnino & Coelho Advogados" className={inputClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Tom de voz</label>
            <textarea value={tom} onChange={(e) => setTom(e.target.value)} rows={5} placeholder="Como a assistente deve falar com os leads deste cliente..." className={inputClass} />
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

        {/* Exemplos de tom de voz — copiar e colar */}
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs font-semibold text-foreground">Exemplos de tom de voz</p>
          <p className="text-[11px] text-muted-foreground">Clique pra usar como base e ajuste.</p>
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
