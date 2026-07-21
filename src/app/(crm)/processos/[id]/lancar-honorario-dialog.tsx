'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { HandCoins } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { criarHonorarioProcesso } from './honorario-actions'

interface Props {
  processoId:         string
  numeroProcesso:     string
  honorarioCalculado: number | null // calcularHonorarios() já feito no server, passado pronto
  jaLancado:          boolean       // true se já existe contas_receber com este processo_id
}

/** "5000.00" (número calculado) → "5000,00" (string editável, sem separador de milhar —
 *  mesmo padrão livre já usado no campo Valor do dialog de guia). */
function formatarValorInicial(v: number | null): string {
  if (v == null || Number.isNaN(v)) return ''
  return v.toFixed(2).replace('.', ',')
}

export function LancarHonorarioDialog({
  processoId, numeroProcesso, honorarioCalculado, jaLancado,
}: Props) {
  const router   = useRouter()
  const [open,       setOpen]       = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [erro,       setErro]       = useState<string | null>(null)
  const [sucesso,    setSucesso]    = useState(false)
  const [descricao,  setDescricao]  = useState(`Honorários — ${numeroProcesso}`)
  const [valorStr,   setValorStr]   = useState(formatarValorInicial(honorarioCalculado))
  const [vencimento, setVencimento] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 15)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  })

  function handleOpen() {
    setErro(null)
    setSucesso(false)
    setDescricao(`Honorários — ${numeroProcesso}`)
    setValorStr(formatarValorInicial(honorarioCalculado))
    setOpen(true)
  }

  async function handleSalvar() {
    setErro(null)
    const valor = parseFloat(valorStr.replace(',', '.'))
    if (!descricao.trim())                return setErro('Descrição obrigatória.')
    if (Number.isNaN(valor) || valor <= 0) return setErro('Informe um valor válido.')
    if (!vencimento)                       return setErro('Data de vencimento obrigatória.')

    setLoading(true)
    try {
      const res = await criarHonorarioProcesso({
        processoId,
        descricao,
        valor,
        dataVencimento: vencimento,
      })
      if (res.error) { setErro(res.error); return }
      setSucesso(true)
      router.refresh()
      setTimeout(() => setOpen(false), 1200)
    } finally {
      setLoading(false)
    }
  }

  // Já existe honorário lançado: nada de reabrir a tentativa de criar 2º —
  // a action já bloqueia server-side, mas a UI deve refletir o estado sem
  // precisar clicar pra descobrir.
  if (jaLancado) {
    return (
      <Link
        href="/financeiro/honorarios"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        Ver honorário no Financeiro →
      </Link>
    )
  }

  const inp = 'h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10'

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
      >
        <HandCoins className="size-3.5" />
        Lançar honorário
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Lançar honorário no Financeiro</DialogTitle>
          </DialogHeader>

          {sucesso ? (
            <div className="py-6 text-center text-sm font-medium text-emerald-600 dark:text-emerald-400">
              Honorário lançado no Financeiro ✓
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
                    placeholder="Ex.: 5000,00"
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
                {loading ? 'Lançando…' : 'Lançar honorário'}
              </button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
