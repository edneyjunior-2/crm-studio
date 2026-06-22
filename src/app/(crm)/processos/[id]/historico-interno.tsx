'use client'

import { useState, useTransition, useOptimistic } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, User, ClipboardList } from 'lucide-react'
import { toast } from 'sonner'
import { criarMovimentacaoInterna } from './actions'

interface MovimentacaoInterna {
  id: string
  assunto: string
  descricao: string | null
  created_at: string
  autor_nome: string | null
}

interface Props {
  processoId: string
  movimentacoes: MovimentacaoInterna[]
}

function formatarDataHora(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso)).replace(',', ' às')
}

export function HistoricoInterno({ processoId, movimentacoes: inicial }: Props) {
  const router = useRouter()
  const [mostrarForm, setMostrarForm] = useState(false)
  const [assunto, setAssunto]         = useState('')
  const [descricao, setDescricao]     = useState('')
  const [pending, start]              = useTransition()

  const [lista, adicionarOtimista] = useOptimistic(
    inicial,
    (prev, nova: MovimentacaoInterna) => [nova, ...prev],
  )

  function salvar() {
    if (!assunto.trim()) return
    const tempId = `temp-${Date.now()}`
    start(async () => {
      adicionarOtimista({
        id:          tempId,
        assunto:     assunto.trim(),
        descricao:   descricao.trim() || null,
        created_at:  new Date().toISOString(),
        autor_nome:  'Você',
      })
      const res = await criarMovimentacaoInterna(processoId, assunto, descricao)
      if (res.error) {
        toast.error(res.error)
      } else {
        setAssunto('')
        setDescricao('')
        setMostrarForm(false)
        router.refresh()
      }
    })
  }

  const inputCls    = 'h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-foreground/40'
  const textareaCls = 'w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <ClipboardList className="size-4 text-muted-foreground" />
          Histórico interno
          {lista.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({lista.length})
            </span>
          )}
        </h3>
        <button
          type="button"
          onClick={() => { setMostrarForm((v) => !v); setAssunto(''); setDescricao('') }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
        >
          <Plus className="size-3.5" />
          Registrar
        </button>
      </div>

      {/* Formulário inline */}
      {mostrarForm && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              Assunto <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              placeholder="Ex: Contato com cliente, Protocolo de petição, Despacho interno…"
              maxLength={200}
              className={inputCls}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Descrição</label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Detalhes adicionais (opcional)"
              rows={2}
              className={textareaCls}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setMostrarForm(false)}
              className="h-8 rounded-lg border border-border px-3 text-sm text-foreground transition-colors hover:bg-accent"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={salvar}
              disabled={pending || !assunto.trim()}
              className="h-8 rounded-lg bg-foreground px-4 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
            >
              {pending ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {/* Lista de movimentações */}
      {lista.length === 0 && !mostrarForm ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhuma movimentação interna registrada ainda.
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {lista.map((m) => (
            <div key={m.id} className="flex gap-3 px-4 py-3">
              <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted">
                <User className="size-3.5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <p className="text-sm font-semibold text-foreground">{m.assunto}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.autor_nome ?? 'Sistema'} · {formatarDataHora(m.created_at)}
                  </p>
                </div>
                {m.descricao && (
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {m.descricao}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
