'use client'

import { useState, useTransition } from 'react'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { criarOrcamento } from './actions'

export function NovoOrcamentoButton({ obras }: { obras: { id: string; nome: string }[] }) {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()

  function submit(formData: FormData) {
    start(async () => {
      const res = await criarOrcamento(formData)
      if (res?.error) toast.error(res.error)
      // sucesso → redirect dentro da action
    })
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background hover:bg-foreground/90">
        <Plus className="size-4" /> Novo orçamento
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !pending && setOpen(false)}>
          <form action={submit} onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Novo orçamento</h2>
              <button type="button" onClick={() => setOpen(false)} className="rounded p-1 hover:bg-muted"><X className="size-4" /></button>
            </div>
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Título *</span>
                <input name="titulo" required placeholder="Ex.: Casa Residencial Vila Nova"
                  className="rounded-lg border border-border bg-background px-3 py-2" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">Modelo</span>
                  <select name="modelo" defaultValue="mao_obra_material" className="rounded-lg border border-border bg-background px-3 py-2">
                    <option value="mao_obra_material">Mão de obra + material</option>
                    <option value="mao_obra">Só mão de obra</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">UF (SINAPI)</span>
                  <input name="uf" defaultValue="BA" maxLength={2} className="rounded-lg border border-border bg-background px-3 py-2 uppercase" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">Mês SINAPI</span>
                  <input type="month" name="data_ref_sinapi" className="rounded-lg border border-border bg-background px-3 py-2" />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">Obra (opcional)</span>
                  <select name="obra_id" className="rounded-lg border border-border bg-background px-3 py-2">
                    <option value="">— avulso —</option>
                    {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                  </select>
                </label>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted">Cancelar</button>
              <button type="submit" disabled={pending} className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-60">
                {pending ? 'Criando…' : 'Criar e editar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
