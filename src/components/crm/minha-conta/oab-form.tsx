'use client'

import { useState, type FormEvent } from 'react'
import { Check } from 'lucide-react'
import { toast } from 'sonner'
import { updateOwnOab } from '@/app/(crm)/minha-conta/actions'

interface OabFormProps {
  oabNumero: string | null
  oabUf: string | null
}

// Salvamento explícito via <form onSubmit> (botão + Enter nativos do HTML) —
// substituiu o autosave-on-blur anterior, que ficava mudo (sem toast, sem
// feedback nenhum) quando o usuário só preenchia um campo e apertava Enter em
// vez de sair do campo por clique/tab. Reportado por cliente: "não salva e
// não aparece nada".
export function OabForm({ oabNumero, oabUf }: OabFormProps) {
  const [numero, setNumero] = useState(oabNumero ?? '')
  const [uf, setUf] = useState(oabUf ?? '')
  const [salvando, setSalvando] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const numeroTrimmed = numero.trim()
    const ufTrimmed = uf.trim().toUpperCase()

    if (!numeroTrimmed || !ufTrimmed) {
      toast.error('Preencha o número da OAB e a UF antes de salvar.')
      return
    }

    setSalvando(true)
    const result = await updateOwnOab(numeroTrimmed, ufTrimmed)
    setSalvando(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    setNumero(numeroTrimmed)
    setUf(ufTrimmed)
    toast.success('OAB salva com sucesso.')
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label
            htmlFor="oab-numero"
            className="text-xs text-muted-foreground uppercase tracking-wide font-medium"
          >
            Número da OAB
          </label>
          <input
            id="oab-numero"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="Ex: 123456"
            className="mt-1 h-9 w-40 rounded-lg border border-border bg-background px-2.5 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-foreground/40"
          />
        </div>
        <div>
          <label
            htmlFor="oab-uf"
            className="text-xs text-muted-foreground uppercase tracking-wide font-medium"
          >
            UF
          </label>
          <input
            id="oab-uf"
            value={uf}
            onChange={(e) => setUf(e.target.value)}
            placeholder="SP"
            maxLength={2}
            className="mt-1 h-9 w-16 rounded-lg border border-border bg-background px-2.5 text-sm font-medium uppercase text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-foreground/40"
          />
        </div>
        <button
          type="submit"
          disabled={salvando}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          {!salvando && <Check className="size-3.5" />}
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Usado para buscar automaticamente as publicações do Diário de Justiça (DJEN) nos seus processos.
      </p>
    </form>
  )
}
