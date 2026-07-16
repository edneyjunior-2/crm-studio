'use client'

import { useActionState } from 'react'
import { AlertCircle } from 'lucide-react'
import { atualizarMotorista } from '../../actions'

const CATEGORIAS = ['A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE']

const VINCULOS = [
  { value: 'autonomo', label: 'Autônomo' },
  { value: 'clt',      label: 'CLT' },
]

interface Motorista {
  id: string; nome: string; cpf: string; cnh_numero: string; cnh_categoria: string
  cnh_validade: string | null; vinculo: string; rntrc: string | null
  observacoes: string | null; ativo: boolean
}

interface Props {
  motorista: Motorista
}

const inp = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10'
const lbl = 'text-sm font-medium text-foreground'

export function EditarMotoristaForm({ motorista }: Props) {
  const [state, action, isPending] = useActionState(atualizarMotorista, null)

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-5 rounded-xl border border-border bg-card p-6">
      <input type="hidden" name="motorista_id" value={motorista.id} />

      {state?.error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {state.error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={lbl} htmlFor="nome">Nome *</label>
          <input id="nome" name="nome" required defaultValue={motorista.nome} className={inp} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={lbl} htmlFor="cpf">CPF</label>
          <input id="cpf" name="cpf" defaultValue={motorista.cpf ?? ''} className={inp} maxLength={14} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={lbl} htmlFor="vinculo">Vínculo *</label>
          <select id="vinculo" name="vinculo" required defaultValue={motorista.vinculo} className={inp}>
            {VINCULOS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
          </select>
        </div>

        {/* CNH número/categoria não obrigatórios: podem ser preenchidos depois via
            leitura automática da foto (ver CnhUploadSection na tela de detalhe) */}
        <div className="flex flex-col gap-1.5">
          <label className={lbl} htmlFor="cnh_numero">Número da CNH</label>
          <input id="cnh_numero" name="cnh_numero" defaultValue={motorista.cnh_numero ?? ''} className={inp} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={lbl} htmlFor="cnh_categoria">Categoria</label>
          <select id="cnh_categoria" name="cnh_categoria" defaultValue={motorista.cnh_categoria ?? ''} className={inp}>
            <option value="">Selecione…</option>
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={lbl} htmlFor="cnh_validade">Validade da CNH</label>
          <input id="cnh_validade" name="cnh_validade" type="date" defaultValue={motorista.cnh_validade ?? ''} className={inp} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={lbl} htmlFor="rntrc">RNTRC</label>
          <input id="rntrc" name="rntrc" defaultValue={motorista.rntrc ?? ''} className={inp} placeholder="Opcional" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={lbl} htmlFor="ativo">Status</label>
          <select id="ativo" name="ativo" defaultValue={String(motorista.ativo)} className={inp}>
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
            defaultValue={motorista.observacoes ?? ''}
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={isPending}
          className="rounded-lg bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-60">
          {isPending ? 'Salvando…' : 'Salvar alterações'}
        </button>
        <a href={`/frete/motoristas/${motorista.id}`}
          className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent">
          Cancelar
        </a>
      </div>
    </form>
  )
}
