'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bot, Check, Loader2, Copy, Lightbulb, Sparkles, Lock } from 'lucide-react'
import { salvarConfigSdrEmpresa } from '@/app/(crm)/configuracoes/actions'

interface ConfigSdr {
  wa_phone_number_id:      string | null
  nome_escritorio:         string | null
  nome_assistente:         string | null
  tom_de_voz:              string | null
  topicos_proibidos?:      string | null
  horario_inicio?:         string | null
  horario_fim?:            string | null
  dias_uteis?:             number[] | null
  palavras_chave_handoff?: string | null
  mensagem_fora_horario?:  string | null
  mensagem_handoff?:       string | null
  sugestao_sdr?:           string | null
}

const DIAS_SEMANA = [
  { valor: 1, label: 'Seg' },
  { valor: 2, label: 'Ter' },
  { valor: 3, label: 'Qua' },
  { valor: 4, label: 'Qui' },
  { valor: 5, label: 'Sex' },
  { valor: 6, label: 'Sáb' },
  { valor: 7, label: 'Dom' },
]

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

export function ConfigSdrSection({ config, ativo = true }: { config: ConfigSdr | null; ativo?: boolean }) {
  const router = useRouter()
  // wa_phone_number_id não é mais editável nesta tela (é plumbing de integração,
  // configurado pelo time do CRM Studio no onboarding — não pelo cliente). O
  // valor atual só é preservado no submit, nunca alterado por aqui.
  const [wa] = useState(config?.wa_phone_number_id ?? '')
  const [escritorio, setEscritorio] = useState(config?.nome_escritorio ?? '')
  const [assistente, setAssistente] = useState(config?.nome_assistente ?? 'Leila')
  const [tom, setTom]               = useState(config?.tom_de_voz ?? '')
  const [topicos, setTopicos]       = useState(config?.topicos_proibidos ?? '')
  const [horaInicio, setHoraInicio] = useState(config?.horario_inicio ?? '')
  const [horaFim, setHoraFim]       = useState(config?.horario_fim ?? '')
  const [dias, setDias]             = useState<number[]>(config?.dias_uteis ?? [1, 2, 3, 4, 5])
  const [palavras, setPalavras]     = useState(config?.palavras_chave_handoff ?? '')
  const [msgHorario, setMsgHorario] = useState(config?.mensagem_fora_horario ?? '')
  const [msgHandoff, setMsgHandoff] = useState(config?.mensagem_handoff ?? '')
  const [erro, setErro]             = useState<string | null>(null)
  const [ok, setOk]                 = useState(false)
  const [salvando, startSalvar]     = useTransition()

  function alternarDia(valor: number) {
    setDias((atual) => (atual.includes(valor) ? atual.filter((d) => d !== valor) : [...atual, valor].sort()))
  }

  const sugestao = config?.sugestao_sdr ?? null

  const inputClass = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40'

  function salvar() {
    setErro(null); setOk(false)
    const fd = new FormData()
    fd.set('wa_phone_number_id', wa)
    fd.set('nome_escritorio', escritorio)
    fd.set('nome_assistente', assistente)
    fd.set('tom_de_voz', tom)
    fd.set('topicos_proibidos', topicos)
    fd.set('horario_inicio', horaInicio)
    fd.set('horario_fim', horaFim)
    dias.forEach((d) => fd.append('dias_uteis', String(d)))
    fd.set('palavras_chave_handoff', palavras)
    fd.set('mensagem_fora_horario', msgHorario)
    fd.set('mensagem_handoff', msgHandoff)
    startSalvar(async () => {
      const res = await salvarConfigSdrEmpresa(fd)
      if (res.error) { setErro(res.error); return }
      setOk(true)
      setTimeout(() => setOk(false), 2500)
      router.refresh()
    })
  }

  return (
    <div className={`flex flex-col gap-5 rounded-xl border bg-card p-5 ${ativo ? 'border-border' : 'border-border opacity-75'}`}>
      <div className="flex items-start justify-between gap-4">
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
        {!ativo && (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            <Lock className="size-3" />
            Não habilitado
          </span>
        )}
      </div>

      {/* Banner quando módulo não está ativo */}
      {!ativo && (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-5 text-center">
          <p className="text-sm font-medium text-foreground">Módulo SDR não habilitado no seu plano</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Entre em contato com o suporte para ativar o Agente SDR e começar a atender leads automaticamente pelo WhatsApp.
          </p>
        </div>
      )}

      {/* Formulário — só aparece quando módulo está ativo */}
      {ativo && sugestao && (
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

      {ativo && <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        {/* Formulário */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Nome da assistente</label>
            <input
              value={assistente}
              onChange={(e) => setAssistente(e.target.value)}
              placeholder="Ex.: Leila, Sofia, Ana…"
              className={inputClass}
            />
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

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Tópicos que a assistente nunca deve comentar <span className="text-muted-foreground/60">(opcional)</span>
            </label>
            <textarea
              value={topicos}
              onChange={(e) => setTopicos(e.target.value)}
              rows={2}
              placeholder="Ex.: não comentar sobre concorrentes, não falar de processos de outros clientes…"
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
            <label className="text-xs font-medium text-muted-foreground">
              Horário de expediente <span className="text-muted-foreground/60">(opcional — fora dele, a assistente avisa em vez de tentar atender)</span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
                className={`${inputClass} w-auto`}
              />
              <span className="text-xs text-muted-foreground">até</span>
              <input
                type="time"
                value={horaFim}
                onChange={(e) => setHoraFim(e.target.value)}
                className={`${inputClass} w-auto`}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DIAS_SEMANA.map((d) => (
                <button
                  key={d.valor}
                  type="button"
                  onClick={() => alternarDia(d.valor)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                    dias.includes(d.valor)
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border bg-background text-muted-foreground'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            {(horaInicio || horaFim) && (
              <div className="flex flex-col gap-1.5 pt-1">
                <label className="text-xs font-medium text-muted-foreground">Mensagem fora do expediente</label>
                <textarea
                  value={msgHorario}
                  onChange={(e) => setMsgHorario(e.target.value)}
                  rows={2}
                  placeholder="Ex.: No momento estamos fora do horário de atendimento. Assim que reabrirmos, te respondemos!"
                  className={inputClass}
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
            <label className="text-xs font-medium text-muted-foreground">
              Transferir pra humano quando o lead disser <span className="text-muted-foreground/60">(opcional — uma palavra/frase por linha)</span>
            </label>
            <textarea
              value={palavras}
              onChange={(e) => setPalavras(e.target.value)}
              rows={2}
              placeholder={'Ex.:\nfalar com atendente\nquero um humano'}
              className={inputClass}
            />
            <p className="text-[11px] text-muted-foreground/70">
              Se o lead escrever qualquer uma dessas frases, a conversa passa direto pra um atendente da sua equipe.
            </p>
            {palavras.trim() && (
              <div className="flex flex-col gap-1.5 pt-1">
                <label className="text-xs font-medium text-muted-foreground">Mensagem ao transferir</label>
                <textarea
                  value={msgHandoff}
                  onChange={(e) => setMsgHandoff(e.target.value)}
                  rows={2}
                  placeholder="Ex.: Vou te transferir pra alguém da nossa equipe, só um instante! 🙂"
                  className={inputClass}
                />
              </div>
            )}
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
      </div>}
    </div>
  )
}
