'use client'

import { useState } from 'react'
import { Briefcase, Scale } from 'lucide-react'
import { atualizarAreaAtuacao } from '../actions'

const AREAS = [
  { value: 'vendas',    label: 'CRM de Vendas', desc: 'Pipeline, clientes, financeiro, contratos', icon: Briefcase },
  { value: 'advocacia', label: 'CRM Advocacia', desc: 'Tudo + Processos Jurídicos (DataJud)',       icon: Scale },
]

export function AreaAtuacaoSection({
  empresaId,
  area,
}: {
  empresaId: string
  area: 'vendas' | 'advocacia'
}) {
  const [selecionada, setSelecionada] = useState<string>(area)
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

      <div className="grid gap-2 sm:grid-cols-2">
        {AREAS.map((a) => {
          const Icon = a.icon
          const ativa = selecionada === a.value
          return (
            <button
              key={a.value}
              type="button"
              onClick={() => setSelecionada(a.value)}
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
    </form>
  )
}
