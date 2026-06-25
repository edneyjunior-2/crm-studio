'use client'

import { useRouter } from 'next/navigation'

interface Obra {
  id: string
  nome: string
}

interface ObraFilterProps {
  obras: Obra[]
  obraAtual: string | null
  data: string
}

export function ObraFilter({ obras, obraAtual, data }: ObraFilterProps) {
  const router = useRouter()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams()
    params.set('data', data)
    if (e.target.value) params.set('obra', e.target.value)
    router.push(`/rh/ponto?${params.toString()}`)
  }

  if (obras.length === 0) return null

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <span className="shrink-0 text-sm font-medium text-muted-foreground">Filtrar por obra:</span>
      <select
        value={obraAtual ?? ''}
        onChange={handleChange}
        className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-foreground/40"
      >
        <option value="">Todos os colaboradores</option>
        {obras.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nome}
          </option>
        ))}
      </select>
    </div>
  )
}
