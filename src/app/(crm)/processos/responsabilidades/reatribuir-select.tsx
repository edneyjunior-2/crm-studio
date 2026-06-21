'use client'

import { useState, useTransition } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { reatribuirResponsavel } from './actions'

interface Membro {
  id:    string
  nome:  string
  cargo: string | null
}

interface Props {
  processoId:  string
  advogadoId:  string | null
  membros:     Membro[]
  readonly:    boolean
}

export function ReatribuirSelect({ processoId, advogadoId, membros, readonly }: Props) {
  const [valor, setValor]          = useState(advogadoId ?? '')
  const [salvo, setSalvo]          = useState(false)
  const [erro,  setErro]           = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (readonly) {
    const m = membros.find((m) => m.id === advogadoId)
    return m ? (
      <div className="flex flex-col leading-tight">
        <span className="text-sm text-foreground">{m.nome}</span>
        {m.cargo && <span className="text-[11px] text-muted-foreground">{m.cargo}</span>}
      </div>
    ) : (
      <span className="italic text-sm text-muted-foreground">Sem responsável</span>
    )
  }

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const novo = e.target.value
    setValor(novo)
    setSalvo(false)
    setErro(null)
    startTransition(async () => {
      const res = await reatribuirResponsavel(processoId, novo || null)
      if (res.error) setErro(res.error)
      else setSalvo(true)
    })
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={valor}
        onChange={handleChange}
        disabled={pending}
        className="h-8 rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-foreground/40 disabled:opacity-50"
      >
        <option value="">— Sem responsável</option>
        {membros.map((m) => (
          <option key={m.id} value={m.id}>
            {m.cargo ? `${m.nome} · ${m.cargo}` : m.nome}
          </option>
        ))}
      </select>
      {pending && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
      {salvo   && <Check   className="size-3.5 text-chart-5" />}
      {erro    && <span className="text-xs text-destructive">{erro}</span>}
    </div>
  )
}
