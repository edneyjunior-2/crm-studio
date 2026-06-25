'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Receipt } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { criarGuiaProcesso } from './guia-actions'

const CATEGORIAS = [
  'Custas Judiciais',
  'Honorários',
  'Emolumentos',
  'Despesas Processuais',
  'Peritos / Laudos',
  'Outros',
]

interface Props {
  processoId:     string
  numeroProcesso: string
}

export function SolicitarGuiaDialog({ processoId, numeroProcesso }: Props) {
  const router   = useRouter()
  const [open,       setOpen]       = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [erro,       setErro]       = useState<string | null>(null)
  const [sucesso,    setSucesso]    = useState(false)
  const [descricao,  setDescricao]  = useState(`Guia — ${numeroProcesso}`)
  const [valorStr,   setValorStr]   = useState('')
  const [vencimento, setVencimento] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 15)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  })
  const [categoria, setCategoria] = useState('Custas Judiciais')

  function handleOpen() {
    setErro(null)
    setSucesso(false)
    setDescricao(`Guia — ${numeroProcesso}`)
    setValorStr('')
    setCategoria('Custas Judiciais')
    setOpen(true)
  }

  async function handleSalvar() {
    setErro(null)
    const valor = parseFloat(valorStr.replace(',', '.'))
    if (!descricao.trim())        return setErro('Descrição obrigatória.')
    if (Number.isNaN(valor) || valor <= 0) return setErro('Informe um valor válido.')
    if (!vencimento)               return setErro('Data de vencimento obrigatória.')

    setLoading(true)
    try {
      const res = await criarGuiaProcesso({
        processoId,
        descricao,
        valor,
        dataVencimento: vencimento,
        categoria,
      })
      if (res.error) { setErro(res.error); return }
      setSucesso(true)
      router.refresh()
      setTimeout(() => setOpen(false), 1200)
    } finally {
      setLoading(false)
    }
  }

  const inp = 'h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10'

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
      >
        <Receipt className="size-3.5" />
        Solicitar guia
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Solicitar pagamento de guia</DialogTitle>
          </DialogHeader>

          {sucesso ? (
            <div className="py-6 text-center text-sm font-medium text-emerald-600 dark:text-emerald-400">
              Guia criada com sucesso no Financeiro ✓
            </div>
          ) : (
            <div className="flex flex-col gap-3 py-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Descrição *</label>
                <input
                  type="text"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className={inp}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">Valor (R$) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={valorStr}
                    onChange={(e) => setValorStr(e.target.value)}
                    placeholder="Ex.: 250,00"
                    className={inp}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">Vencimento *</label>
                  <input
                    type="date"
                    value={vencimento}
                    onChange={(e) => setVencimento(e.target.value)}
                    className={inp}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Categoria</label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className={inp}
                >
                  {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {erro && <p className="text-sm text-destructive">{erro}</p>}
            </div>
          )}

          {!sucesso && (
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
                disabled={loading}
                className="h-9 rounded-lg bg-foreground px-4 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
              >
                {loading ? 'Criando…' : 'Criar guia'}
              </button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
