'use client'

import { useState } from 'react'
import { Search, ChevronDown } from 'lucide-react'

interface ClienteOption { id: string; razao_social: string }

interface Props {
  clientes: ClienteOption[]
  value: string[]
  onToggle: (id: string) => void
  /** name do checkbox no FormData — permite formData.getAll(name) na server action. */
  name: string
}

/**
 * Seletor múltiplo de clientes: aba expansiva (<details>) com busca por nome.
 * O primeiro id em `value` é sempre o cliente principal (convenção do módulo
 * Processos — ver .claude/specs/processos-multiplos-clientes.md).
 */
export function SeletorClientes({ clientes, value, onToggle, name }: Props) {
  const [busca, setBusca] = useState('')

  const filtrados = busca.trim()
    ? clientes.filter((c) => c.razao_social.toLowerCase().includes(busca.trim().toLowerCase()))
    : clientes

  const resumo =
    value.length === 0
      ? 'Nenhum cliente selecionado'
      : value.length === 1
        ? (clientes.find((c) => c.id === value[0])?.razao_social ?? '1 cliente selecionado')
        : `${value.length} clientes selecionados`

  return (
    <details className="group rounded-lg border border-border bg-background">
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm marker:hidden">
        <span className={value.length ? 'font-medium text-foreground' : 'text-muted-foreground'}>{resumo}</span>
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>

      <div className="flex flex-col gap-2 border-t border-border p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente pelo nome..."
            className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-2 text-sm outline-none focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10"
          />
        </div>

        <div className="flex max-h-48 flex-col gap-0.5 overflow-y-auto">
          {filtrados.length === 0 ? (
            <p className="px-1.5 py-1 text-sm text-muted-foreground">
              {clientes.length === 0 ? 'Nenhum cliente cadastrado.' : 'Nenhum cliente encontrado.'}
            </p>
          ) : (
            filtrados.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-muted"
              >
                <input
                  type="checkbox"
                  name={name}
                  value={c.id}
                  checked={value.includes(c.id)}
                  onChange={() => onToggle(c.id)}
                />
                <span className="truncate">{c.razao_social}</span>
                {value[0] === c.id && (
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">principal</span>
                )}
              </label>
            ))
          )}
        </div>
      </div>
    </details>
  )
}
