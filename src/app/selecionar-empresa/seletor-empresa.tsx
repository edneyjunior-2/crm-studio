'use client'

import { useState, useTransition, useMemo } from 'react'
import { Building2, Search, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'
import { selecionarEmpresa } from './actions'

interface Empresa {
  id: string
  nome: string
  status: string
  plano: string
}

const STATUS_LABEL: Record<string, string> = {
  trial:     'Trial',
  ativo:     'Ativo',
  pendente:  'Pendente',
  atrasado:  'Atrasado',
  suspenso:  'Suspenso',
  cancelado: 'Cancelado',
}

const STATUS_COLOR: Record<string, string> = {
  trial:     'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  ativo:     'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  pendente:  'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  atrasado:  'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  suspenso:  'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  cancelado: 'bg-muted text-muted-foreground',
}

const PLANO_LABEL: Record<string, string> = {
  free:     'Free',
  trial:    'Trial',
  interno:  'Interno',
  starter:  'Starter',
  pro:      'Pro',
  business: 'Business',
}

export function SeletorEmpresa({ empresas }: { empresas: Empresa[] }) {
  const [busca, setBusca] = useState('')
  const [selecionando, setSelecionando] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const empresasFiltradas = useMemo(() => {
    const termo = busca.toLowerCase().trim()
    if (!termo) return empresas
    return empresas.filter((e) => e.nome.toLowerCase().includes(termo))
  }, [empresas, busca])

  function handleSelecionar(empresa: Empresa) {
    setSelecionando(empresa.id)
    startTransition(async () => {
      const res = await selecionarEmpresa(empresa.id)
      // Se chegou aqui, a action retornou erro (sucesso redireciona)
      if (res?.error) {
        toast.error(res.error)
        setSelecionando(null)
      }
    })
  }

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      {/* Campo de busca */}
      <div className="border-b border-border p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar empresa…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={isPending}
          />
        </div>
      </div>

      {/* Lista de empresas */}
      <ul className="max-h-[420px] overflow-y-auto divide-y divide-border/60">
        {empresasFiltradas.length === 0 && (
          <li className="flex flex-col items-center gap-2 px-6 py-10 text-center text-sm text-muted-foreground">
            <Building2 className="size-8 opacity-40" />
            <span>Nenhuma empresa encontrada</span>
          </li>
        )}

        {empresasFiltradas.map((empresa) => {
          const estaCarregando = selecionando === empresa.id && isPending

          return (
            <li key={empresa.id}>
              <button
                type="button"
                onClick={() => handleSelecionar(empresa)}
                disabled={isPending}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {/* Ícone / loading */}
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/10">
                  {estaCarregando
                    ? <Loader2 className="size-4 animate-spin text-accent" />
                    : <Building2 className="size-4 text-accent" />
                  }
                </div>

                {/* Nome e badges */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{empresa.nome}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLOR[empresa.status] ?? 'bg-muted text-muted-foreground'}`}>
                      {STATUS_LABEL[empresa.status] ?? empresa.status}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {PLANO_LABEL[empresa.plano] ?? empresa.plano}
                    </span>
                  </div>
                </div>

                {/* Indicador de seleção */}
                {estaCarregando && (
                  <Check className="size-4 shrink-0 text-accent" />
                )}
              </button>
            </li>
          )
        })}
      </ul>

      {/* Rodapé informativo */}
      {empresas.length > 0 && (
        <div className="border-t border-border px-5 py-3">
          <p className="text-xs text-muted-foreground">
            {empresas.length} {empresas.length === 1 ? 'empresa' : 'empresas'} disponíve{empresas.length === 1 ? 'l' : 'is'}
          </p>
        </div>
      )}
    </div>
  )
}
