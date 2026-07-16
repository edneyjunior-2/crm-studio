'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Pencil, Trash2, Loader2 } from 'lucide-react'
import { excluirVeiculo } from '../actions'

interface Props {
  veiculoId: string
  /** DELETE em frete_veiculos é restrito a admin via RLS (policy delete_admin) — esconde o botão pra quem não pode. */
  podeExcluir: boolean
}

export function VeiculoAcoes({ veiculoId, podeExcluir }: Props) {
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  function handleExcluir() {
    if (!confirm('Excluir este veículo permanentemente? Esta ação não pode ser desfeita.')) return
    setErro(null)
    startTransition(async () => {
      const res = await excluirVeiculo(veiculoId)
      if (res?.error) setErro(res.error)
    })
  }

  return (
    <div className="flex items-center gap-2">
      {erro && <p className="text-xs text-destructive">{erro}</p>}
      <Link
        href={`/frete/veiculos/${veiculoId}/editar`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
      >
        <Pencil className="size-3.5" />
        Editar
      </Link>
      {podeExcluir && (
        <button
          type="button"
          onClick={handleExcluir}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/5 disabled:opacity-50"
        >
          {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
          Excluir
        </button>
      )}
    </div>
  )
}
