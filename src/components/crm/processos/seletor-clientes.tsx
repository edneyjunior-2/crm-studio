'use client'

import { useState } from 'react'
import { Search, ChevronDown, X } from 'lucide-react'

interface ClienteOption { id: string; razao_social: string }

interface Props {
  clientes: ClienteOption[]
  value: string[]
  onToggle: (id: string) => void
  /** name dos inputs no FormData — permite formData.getAll(name) na server action. */
  name: string
}

/**
 * Seletor múltiplo de clientes: os já selecionados ficam fixos no topo (o
 * primeiro é sempre o principal — convenção do módulo Processos, ver
 * .claude/specs/processos-multiplos-clientes.md), cada um com botão de
 * remover. Abaixo, uma aba expansiva com busca por nome pra adicionar mais.
 */
export function SeletorClientes({ clientes, value, onToggle, name }: Props) {
  const [busca, setBusca] = useState('')

  const porId = new Map(clientes.map((c) => [c.id, c]))
  const selecionados = value
    .map((id) => porId.get(id))
    .filter((c): c is ClienteOption => !!c)

  const disponiveis = clientes.filter((c) => !value.includes(c.id))
  const filtrados = busca.trim()
    ? disponiveis.filter((c) => c.razao_social.toLowerCase().includes(busca.trim().toLowerCase()))
    : disponiveis

  return (
    <div className="flex flex-col gap-2">
      {/* Selecionados — principal primeiro, com botão de remover */}
      {selecionados.length > 0 && (
        <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-background p-1.5">
          {selecionados.map((c, idx) => (
            <div key={c.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm">
              <span className="min-w-0 flex-1 truncate">{c.razao_social}</span>
              {idx === 0 && (
                <span className="shrink-0 text-xs text-muted-foreground">principal</span>
              )}
              <button
                type="button"
                onClick={() => onToggle(c.id)}
                aria-label={`Remover ${c.razao_social}`}
                className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="size-3.5" />
              </button>
              {/* Submissão do form: um hidden input por selecionado, mesma
                  convenção de nome do checkbox anterior (formData.getAll). */}
              <input type="hidden" name={name} value={c.id} />
            </div>
          ))}
        </div>
      )}

      {/* Adicionar cliente — aba expansiva com busca, sempre abaixo dos selecionados */}
      <details className="group rounded-lg border border-border bg-background">
        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm text-muted-foreground marker:hidden">
          <span>+ Adicionar cliente</span>
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
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
                {disponiveis.length === 0 ? 'Todos os clientes já foram selecionados.' : 'Nenhum cliente encontrado.'}
              </p>
            ) : (
              filtrados.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onToggle(c.id)}
                  className="flex items-center rounded-md px-1.5 py-1 text-left text-sm transition-colors hover:bg-muted"
                >
                  <span className="truncate">{c.razao_social}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </details>
    </div>
  )
}
