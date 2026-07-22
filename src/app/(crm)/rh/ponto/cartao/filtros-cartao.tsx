'use client'

import { useRouter } from 'next/navigation'

interface ColaboradorOpcao {
  id: string
  nome: string
  cargo: string | null
}

interface Props {
  colaboradores: ColaboradorOpcao[]
  colaboradorAtual: string
  mes: string
}

export function FiltrosCartao({ colaboradores, colaboradorAtual, mes }: Props) {
  const router = useRouter()

  function irPara(novoColaborador: string, novoMes: string) {
    const params = new URLSearchParams()
    params.set('colaborador', novoColaborador)
    params.set('mes', novoMes)
    router.push(`/rh/ponto/cartao?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <span className="shrink-0 text-sm font-medium text-muted-foreground">Colaborador:</span>
      <select
        value={colaboradorAtual}
        onChange={(e) => irPara(e.target.value, mes)}
        className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-foreground/40"
      >
        {colaboradores.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
            {c.cargo ? ` — ${c.cargo}` : ''}
          </option>
        ))}
      </select>

      <input
        type="month"
        value={mes}
        onChange={(e) => e.target.value && irPara(colaboradorAtual, e.target.value)}
        className="shrink-0 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-foreground/40"
      />
    </div>
  )
}
