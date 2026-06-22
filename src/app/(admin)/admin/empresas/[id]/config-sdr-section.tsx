'use client'

import { useState, useTransition } from 'react'
import { Bot, Lock, Lightbulb, Check, Loader2 } from 'lucide-react'
import { salvarSugestaoSdr } from '../actions'

interface Props {
  empresaId:      string
  config: {
    nome_assistente:    string | null
    nome_escritorio:    string | null
    wa_phone_number_id: string | null
    tom_de_voz:         string | null
    sugestao_sdr:       string | null
  } | null
}

function CampoReadOnly({ label, valor, mono }: { label: string; valor: string | null; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {valor ? (
        <span className={`text-sm text-foreground ${mono ? 'font-mono text-xs' : ''}`}>{valor}</span>
      ) : (
        <span className="text-sm italic text-muted-foreground/40">Não configurado pelo cliente</span>
      )}
    </div>
  )
}

export function ConfigSdrSection({ empresaId, config }: Props) {
  const [sugestao, setSugestao] = useState(config?.sugestao_sdr ?? '')
  const [ok, setOk]             = useState(false)
  const [erro, setErro]         = useState<string | null>(null)
  const [salvando, start]       = useTransition()

  const clienteConfigurou = !!(
    config?.wa_phone_number_id ||
    config?.nome_escritorio ||
    config?.nome_assistente ||
    config?.tom_de_voz
  )

  function salvar() {
    setErro(null); setOk(false)
    start(async () => {
      const res = await salvarSugestaoSdr(empresaId, sugestao)
      if (res.error) { setErro(res.error); return }
      setOk(true)
      setTimeout(() => setOk(false), 2500)
    })
  }

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Agente SDR — configuração do cliente</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Definida pelo próprio cliente em <strong>Configurações → Agente SDR</strong>.
            Você pode visualizar e enviar uma sugestão de melhoria.
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          <Lock className="size-3" />
          Gerenciado pelo cliente
        </span>
      </div>

      {/* Config atual (somente-leitura) */}
      {!clienteConfigurou ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">O cliente ainda não configurou o SDR IA.</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Quando ele preencher, a configuração aparece aqui.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-muted/20 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoReadOnly label="Nome da assistente" valor={config?.nome_assistente ?? null} />
            <CampoReadOnly label="Nome do escritório / empresa" valor={config?.nome_escritorio ?? null} />
            <CampoReadOnly
              label="phone_number_id (WhatsApp Meta)"
              valor={config?.wa_phone_number_id ?? null}
              mono
            />
          </div>

          {config?.tom_de_voz && (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Tom de voz atual
              </span>
              <div className="whitespace-pre-wrap rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground">
                {config.tom_de_voz}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sugestão do admin */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="size-4 text-amber-500" />
          <span className="text-sm font-medium">Sua sugestão de melhoria</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Escreva abaixo uma sugestão de prompt aprimorado. O cliente verá isso em destaque na
          página de configuração e poderá aplicar com um clique.
        </p>

        <textarea
          value={sugestao}
          onChange={(e) => setSugestao(e.target.value)}
          rows={6}
          placeholder="Ex.: Sugiro ajustar o tom para ser mais consultivo. Tente: 'Olá! Sou [nome], advogada do escritório [escritório]. Antes de tudo, quero entender melhor o que você precisa…'"
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-amber-400 placeholder:text-muted-foreground/50 resize-none"
        />

        {erro && <p className="text-xs text-destructive">{erro}</p>}

        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="inline-flex items-center gap-1.5 self-start rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-60"
        >
          {salvando
            ? <Loader2 className="size-4 animate-spin" />
            : ok
            ? <Check className="size-4" />
            : <Lightbulb className="size-4" />
          }
          {ok ? 'Sugestão enviada!' : 'Enviar sugestão'}
        </button>
      </div>
    </div>
  )
}
