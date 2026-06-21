'use client'

import { useState } from 'react'
import { UserPlus, Check, ExternalLink } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'

interface Props {
  indicacao:    string
  clienteId:    string | null
  parceiroId:   string | null
  parceiroNome: string | null
}

export function IndicacaoParceiroPrompt({ indicacao, clienteId, parceiroId: initialId, parceiroNome: initialNome }: Props) {
  const [parceiroId,   setParceiroId]   = useState<string | null>(initialId)
  const [parceiroNome, setParceiroNome] = useState<string | null>(initialNome)
  const [open,         setOpen]         = useState(false)
  const [nome,         setNome]         = useState(indicacao)
  const [email,        setEmail]        = useState('')
  const [tel,          setTel]          = useState('')
  const [loading,      setLoading]      = useState(false)
  const [erro,         setErro]         = useState<string | null>(null)

  if (parceiroId) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900/30 dark:bg-green-950/20 dark:text-green-400">
        <Check className="size-4 shrink-0" />
        <span>Indicado por <strong>{parceiroNome ?? indicacao}</strong></span>
        <a
          href={`/parceiros/${parceiroId}`}
          className="ml-auto inline-flex items-center gap-1 text-xs underline underline-offset-2 hover:opacity-80"
        >
          Ver parceiro <ExternalLink className="size-3" />
        </a>
      </div>
    )
  }

  async function handleSalvar() {
    setErro(null)
    setLoading(true)
    try {
      const res = await fetch('/api/parceiros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, contato_email: email || undefined, contato_telefone: tel || undefined, cliente_id: clienteId }),
      })
      const data = await res.json() as { id?: string; nome?: string; error?: string }
      if (!res.ok || !data.id) {
        setErro(data.error ?? 'Erro ao criar parceiro')
        return
      }
      setParceiroId(data.id)
      setParceiroNome(data.nome ?? nome)
      setOpen(false)
    } catch {
      setErro('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-foreground/40'

  return (
    <>
      <div className="mt-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900/30 dark:bg-amber-950/20">
        <UserPlus className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="text-amber-800 dark:text-amber-300">
          Indicado por <strong>{indicacao}</strong> — não está cadastrado como parceiro.
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ml-auto shrink-0 rounded-md bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300"
        >
          Cadastrar
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cadastrar parceiro</DialogTitle>
            <DialogDescription>
              Confirme os dados de <strong>{indicacao}</strong> para cadastrá-lo como parceiro da empresa.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Nome *</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} className={inputClass} placeholder="Nome do parceiro" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">E-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="email@exemplo.com" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Telefone</label>
              <input value={tel} onChange={(e) => setTel(e.target.value)} className={inputClass} placeholder="(00) 00000-0000" />
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
              disabled={loading || !nome.trim()}
              className="h-9 rounded-lg bg-foreground px-4 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
            >
              {loading ? 'Salvando…' : 'Cadastrar parceiro'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
