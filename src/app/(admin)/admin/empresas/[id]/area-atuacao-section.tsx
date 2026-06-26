'use client'

import { useState } from 'react'
import { Briefcase, Scale, HardHat, MessagesSquare } from 'lucide-react'
import { atualizarAreaAtuacao } from '../actions'

const AREAS = [
  { value: 'vendas',      label: 'CRM de Vendas',    desc: 'Pipeline, clientes, financeiro, contratos',    icon: Briefcase },
  { value: 'advocacia',   label: 'CRM Advocacia',    desc: 'Tudo + Processos Jurídicos (DataJud)',          icon: Scale    },
  { value: 'engenharia',  label: 'CRM Engenharia',   desc: 'Tudo + Obras, equipe e ponto diário',           icon: HardHat  },
]

const ADDONS_EM_BREVE = [
  {
    label: 'Atendimentos WhatsApp',
    desc: 'Inbox multicanal com bot IA e histórico de conversas',
    icon: MessagesSquare,
  },
]

export function AreaAtuacaoSection({
  empresaId,
  area,
}: {
  empresaId: string
  area: 'vendas' | 'advocacia' | 'engenharia'
}) {
  const [selecionada, setSelecionada] = useState<'vendas' | 'advocacia' | 'engenharia'>(area)
  const atualizar = atualizarAreaAtuacao.bind(null, empresaId)
  const mudou = selecionada !== area

  return (
    <form
      action={atualizar}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5"
    >
      <input type="hidden" name="tipo_atuacao" value={selecionada} />

      <div>
        <h2 className="text-sm font-semibold">Área de atuação</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Define quais módulos a empresa enxerga. Advocacia habilita Processos Jurídicos.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {AREAS.map((a) => {
          const Icon = a.icon
          const ativa = selecionada === a.value
          return (
            <button
              key={a.value}
              type="button"
              onClick={() => setSelecionada(a.value as 'vendas' | 'advocacia' | 'engenharia')}
              className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                ativa ? 'border-foreground bg-foreground/5' : 'border-border hover:border-foreground/30'
              }`}
            >
              <Icon className={`mt-0.5 size-4 shrink-0 ${ativa ? 'text-foreground' : 'text-muted-foreground'}`} />
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${ativa ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {a.label}
                </p>
                <p className="text-xs text-muted-foreground">{a.desc}</p>
              </div>
            </button>
          )
        })}
      </div>

      <button
        type="submit"
        disabled={!mudou}
        className="self-start rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:bg-foreground/90 disabled:opacity-40"
      >
        {mudou ? 'Salvar área de atuação' : 'Área atual salva'}
      </button>

      {/* Add-ons em breve */}
      <div className="mt-1 border-t border-border pt-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Add-ons em breve</p>
        <div className="flex flex-col gap-2">
          {ADDONS_EM_BREVE.map((addon) => {
            const Icon = addon.icon
            return (
              <div
                key={addon.label}
                className="flex items-start gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-3 opacity-60"
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-muted-foreground">{addon.label}</p>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                      Em breve
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{addon.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </form>
  )
}
