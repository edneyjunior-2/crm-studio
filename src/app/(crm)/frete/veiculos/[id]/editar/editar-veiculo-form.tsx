'use client'

import { useActionState } from 'react'
import { AlertCircle } from 'lucide-react'
import { atualizarVeiculo } from '../../actions'

const TIPOS = [
  { value: 'toco',     label: 'Toco' },
  { value: 'truck',    label: 'Truck' },
  { value: 'carreta',  label: 'Carreta' },
  { value: 'bitrem',   label: 'Bitrem' },
  { value: 'rodotrem', label: 'Rodotrem' },
  { value: 'outro',    label: 'Outro' },
]

interface Veiculo {
  id: string; placa: string; tipo: string; eixos: number | null
  rntrc: string | null; observacoes: string | null; ativo: boolean
}

interface Props {
  veiculo: Veiculo
}

const inp = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10'
const lbl = 'text-sm font-medium text-foreground'

export function EditarVeiculoForm({ veiculo }: Props) {
  const [state, action, isPending] = useActionState(atualizarVeiculo, null)

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-5 rounded-xl border border-border bg-card p-6">
      <input type="hidden" name="veiculo_id" value={veiculo.id} />

      {state?.error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {state.error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className={lbl} htmlFor="placa">Placa *</label>
          <input id="placa" name="placa" required defaultValue={veiculo.placa} className={`${inp} uppercase`} maxLength={8} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={lbl} htmlFor="tipo">Tipo *</label>
          <select id="tipo" name="tipo" required defaultValue={veiculo.tipo} className={inp}>
            {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={lbl} htmlFor="eixos">Eixos</label>
          <input id="eixos" name="eixos" type="number" min={1} max={12} defaultValue={veiculo.eixos ?? ''} className={inp} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={lbl} htmlFor="rntrc">RNTRC</label>
          <input id="rntrc" name="rntrc" defaultValue={veiculo.rntrc ?? ''} className={inp} placeholder="Opcional" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={lbl} htmlFor="ativo">Status</label>
          <select id="ativo" name="ativo" defaultValue={String(veiculo.ativo)} className={inp}>
            <option value="true">Ativo</option>
            <option value="false">Inativo</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={lbl} htmlFor="observacoes">Observações</label>
          <textarea
            id="observacoes"
            name="observacoes"
            rows={3}
            defaultValue={veiculo.observacoes ?? ''}
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={isPending}
          className="rounded-lg bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-60">
          {isPending ? 'Salvando…' : 'Salvar alterações'}
        </button>
        <a href={`/frete/veiculos/${veiculo.id}`}
          className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent">
          Cancelar
        </a>
      </div>
    </form>
  )
}
