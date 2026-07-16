'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, AlertCircle } from 'lucide-react'
import { criarMotorista } from '../actions'

const CATEGORIAS = ['A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE']

const VINCULOS = [
  { value: 'autonomo', label: 'Autônomo' },
  { value: 'clt',      label: 'CLT' },
]

const inputClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10'
const labelClass = 'text-sm font-medium text-foreground'
const btnPrimary =
  'inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-50'
const btnSecondary =
  'inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted'

export function NovoMotoristaForm() {
  const [state, action, isPending] = useActionState(criarMotorista, null)
  const router = useRouter()

  useEffect(() => {
    if (state?.id) router.push(`/frete/motoristas/${state.id}`)
  }, [state?.id, router])

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-5 rounded-xl border border-border bg-card p-6">
      {state?.error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {state.error}
        </div>
      )}

      {/* Nome */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="nome">Nome *</label>
        <input id="nome" name="nome" required placeholder="Nome completo" className={inputClass} />
      </div>

      {/* CPF */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="cpf">CPF</label>
        <input id="cpf" name="cpf" placeholder="000.000.000-00" className={inputClass} maxLength={14} />
      </div>

      {/* CNH número + categoria — não obrigatórios aqui: podem ficar em branco e ser
          preenchidos depois via leitura automática da foto na tela de detalhe
          (ver CnhUploadSection) */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="cnh_numero">Número da CNH</label>
          <input id="cnh_numero" name="cnh_numero" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="cnh_categoria">Categoria</label>
          <select id="cnh_categoria" name="cnh_categoria" className={inputClass} defaultValue="">
            <option value="">Selecione…</option>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Validade CNH + Vínculo */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="cnh_validade">Validade da CNH</label>
          <input id="cnh_validade" name="cnh_validade" type="date" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="vinculo">Vínculo *</label>
          <select id="vinculo" name="vinculo" required className={inputClass} defaultValue="autonomo">
            {VINCULOS.map((v) => (
              <option key={v.value} value={v.value}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* RNTRC */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="rntrc">RNTRC</label>
        <input id="rntrc" name="rntrc" placeholder="Opcional (autônomo)" className={inputClass} />
      </div>

      {/* Observações */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="observacoes">Observações</label>
        <textarea
          id="observacoes"
          name="observacoes"
          rows={3}
          placeholder="Detalhes adicionais sobre o motorista…"
          className={`${inputClass} resize-none`}
        />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={isPending} className={btnPrimary}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Salvar motorista
        </button>
        <Link href="/frete/motoristas" className={btnSecondary}>
          Cancelar
        </Link>
      </div>
    </form>
  )
}
