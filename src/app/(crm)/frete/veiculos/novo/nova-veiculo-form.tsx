'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, AlertCircle } from 'lucide-react'
import { criarVeiculo } from '../actions'

const TIPOS = [
  { value: 'toco',     label: 'Toco' },
  { value: 'truck',    label: 'Truck' },
  { value: 'carreta',  label: 'Carreta' },
  { value: 'bitrem',   label: 'Bitrem' },
  { value: 'rodotrem', label: 'Rodotrem' },
  { value: 'outro',    label: 'Outro' },
]

const inputClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10'
const labelClass = 'text-sm font-medium text-foreground'
const btnPrimary =
  'inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-50'
const btnSecondary =
  'inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted'

export function NovaVeiculoForm() {
  const [state, action, isPending] = useActionState(criarVeiculo, null)
  const router = useRouter()

  useEffect(() => {
    if (state?.id) router.push(`/frete/veiculos/${state.id}`)
  }, [state?.id, router])

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-5 rounded-xl border border-border bg-card p-6">
      {state?.error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {state.error}
        </div>
      )}

      {/* Placa */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="placa">Placa *</label>
        <input
          id="placa"
          name="placa"
          required
          placeholder="Ex.: ABC1D23"
          className={`${inputClass} uppercase`}
          maxLength={8}
        />
      </div>

      {/* Tipo — select nativo (mesmo padrão do módulo obras; não é UUID, sem risco de SelectValue). */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="tipo">Tipo *</label>
        <select id="tipo" name="tipo" required className={inputClass} defaultValue="">
          <option value="" disabled>Selecione…</option>
          {TIPOS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Eixos + RNTRC */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="eixos">Eixos</label>
          <input id="eixos" name="eixos" type="number" min={1} max={12} placeholder="Ex.: 3" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="rntrc">RNTRC</label>
          <input id="rntrc" name="rntrc" placeholder="Opcional" className={inputClass} />
        </div>
      </div>

      {/* Observações */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="observacoes">Observações</label>
        <textarea
          id="observacoes"
          name="observacoes"
          rows={3}
          placeholder="Detalhes adicionais sobre o veículo…"
          className={`${inputClass} resize-none`}
        />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={isPending} className={btnPrimary}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Salvar veículo
        </button>
        <Link href="/frete/veiculos" className={btnSecondary}>
          Cancelar
        </Link>
      </div>
    </form>
  )
}
