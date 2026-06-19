'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Check, X, Loader2 } from 'lucide-react'
import { atualizarNomeEmpresa } from '../actions'

export function EditarNomeEmpresa({ empresaId, nome }: { empresaId: string; nome: string }) {
  const router = useRouter()
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(nome)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, startSalvar] = useTransition()

  function salvar() {
    const novo = valor.trim()
    if (!novo) { setErro('O nome não pode ficar vazio.'); return }
    if (novo === nome) { setEditando(false); return }
    setErro(null)
    startSalvar(async () => {
      const res = await atualizarNomeEmpresa(empresaId, novo)
      if (res.error) { setErro(res.error); return }
      setEditando(false)
      router.refresh()
    })
  }

  if (!editando) {
    return (
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{nome}</h1>
        <button
          type="button"
          onClick={() => { setValor(nome); setErro(null); setEditando(true) }}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Editar nome"
          aria-label="Editar nome da empresa"
        >
          <Pencil className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); salvar() }
            if (e.key === 'Escape') setEditando(false)
          }}
          autoFocus
          className="w-full max-w-md rounded-lg border border-border bg-background px-3 py-1.5 text-xl font-bold outline-none focus:border-foreground/40"
        />
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="rounded-md bg-foreground p-2 text-background transition-colors hover:bg-foreground/90 disabled:opacity-60"
          title="Salvar"
        >
          {salvando ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        </button>
        <button
          type="button"
          onClick={() => setEditando(false)}
          disabled={salvando}
          className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:bg-muted"
          title="Cancelar"
        >
          <X className="size-4" />
        </button>
      </div>
      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </div>
  )
}
