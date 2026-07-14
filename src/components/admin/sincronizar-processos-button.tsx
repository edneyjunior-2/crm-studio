'use client'

import { useState } from 'react'
import { RefreshCw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type ResultadoSync = {
  movimentacoes: { atualizados: number; novasMovimentacoes: number; erros: string[] }
  publicacoes: { advogadosProcessados: number; publicacoesNovas: number; erros: string[] }
}

function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`
}

export function SincronizarProcessosButton() {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (loading) return // trava extra contra clique duplo, além do disabled
    setLoading(true)
    try {
      const res = await fetch('/api/admin/sincronizar-processos', { method: 'POST' })
      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error((data as { error?: string } | null)?.error ?? 'Falha ao sincronizar processos.')
      }

      const r = data as ResultadoSync
      const resumo = [
        plural(r.movimentacoes.atualizados, 'processo atualizado', 'processos atualizados'),
        plural(r.movimentacoes.novasMovimentacoes, 'nova movimentação', 'novas movimentações'),
        plural(r.publicacoes.publicacoesNovas, 'nova publicação', 'novas publicações'),
      ].join(', ')

      const totalErros = r.movimentacoes.erros.length + r.publicacoes.erros.length
      if (totalErros > 0) {
        toast.warning(`Sincronização concluída com ${plural(totalErros, 'erro', 'erros')}: ${resumo}.`)
      } else {
        toast.success(`Sincronização concluída: ${resumo}.`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao sincronizar processos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      title="Consulta DataJud e DJEN para todos os clientes — pode levar de segundos a alguns minutos."
      className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading
        ? <><Loader2 className="size-4 animate-spin" /> Sincronizando…</>
        : <><RefreshCw className="size-4" /> Sincronizar processos agora</>
      }
    </button>
  )
}
