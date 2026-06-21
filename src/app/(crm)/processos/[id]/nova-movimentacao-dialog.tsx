'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'

export function NovaMovimentacaoDialog({ processoId }: { processoId: string }) {
  const router = useRouter()
  const [open,       setOpen]       = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [erro,       setErro]       = useState<string | null>(null)
  const [descricao,  setDescricao]  = useState('')
  const [complemento, setComplemento] = useState('')
  const [data, setData] = useState(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  })

  function handleOpen() {
    setErro(null)
    setDescricao('')
    setComplemento('')
    setOpen(true)
  }

  async function handleSalvar() {
    if (!descricao.trim() || !data) return
    setErro(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/processos/${processoId}/movimentacoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descricao, complemento, data_movimentacao: data }),
      })
      const json = await res.json() as { id?: string; error?: string }
      if (!res.ok) { setErro(json.error ?? 'Erro ao salvar'); return }
      setOpen(false)
      router.refresh()
    } catch {
      setErro('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-foreground/40'

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
      >
        <Plus className="size-3.5" />
        Nova movimentação
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Movimentação manual</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Data *</label>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Descrição *</label>
              <input
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Petição protocolada, Despacho judicial, Acordo firmado…"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Complemento</label>
              <textarea
                value={complemento}
                onChange={(e) => setComplemento(e.target.value)}
                placeholder="Detalhes adicionais (opcional)"
                rows={2}
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40"
              />
            </div>
            {erro && <p className="text-sm text-destructive">{erro}</p>}
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-9 rounded-lg border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSalvar}
              disabled={loading || !descricao.trim() || !data}
              className="h-9 rounded-lg bg-foreground px-4 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
            >
              {loading ? 'Salvando…' : 'Salvar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
