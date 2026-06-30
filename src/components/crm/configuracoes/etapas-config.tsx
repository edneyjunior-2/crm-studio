'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ChevronUp,
  ChevronDown,
  Trash2,
  Pencil,
  Check,
  X,
  GitMerge,
  Loader2,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import {
  criarEstagio,
  renomearEstagio,
  setTipoEstagio,
  reordenarEstagios,
  removerEstagio,
} from '@/app/(crm)/configuracoes/etapas-actions'
import type { EstagioPipeline, EstagioTipo } from '@/lib/pipeline-estagios'

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const TIPO_LABEL: Record<EstagioTipo, string> = {
  aberto:  'Aberto',
  ganho:   'Ganho',
  perdido: 'Perdido',
}

const TIPO_OPTIONS: EstagioTipo[] = ['aberto', 'ganho', 'perdido']

function TipoBadge({ tipo }: { tipo: EstagioTipo }) {
  const classes: Record<EstagioTipo, string> = {
    aberto:  'bg-muted text-muted-foreground',
    ganho:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
    perdido: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${classes[tipo]}`}>
      {TIPO_LABEL[tipo]}
    </span>
  )
}

// ---------------------------------------------------------------------------
// componente principal
// ---------------------------------------------------------------------------

interface Props {
  estagios: EstagioPipeline[]
}

export function EtapasConfig({ estagios: initialEstagios }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // estado local espelha a ordem visualmente antes do server revalidar
  const [lista, setLista] = useState<EstagioPipeline[]>(initialEstagios)

  // edição inline de nome
  const [editandoId, setEditandoId]     = useState<string | null>(null)
  const [editandoNome, setEditandoNome] = useState('')

  // form de adição
  const [novoNome, setNovoNome]   = useState('')
  const [novoTipo, setNovoTipo]   = useState<EstagioTipo>('aberto')

  function refresh() {
    router.refresh()
  }

  // ---- renomear inline ----
  function iniciarEdicao(estagio: EstagioPipeline) {
    setEditandoId(estagio.id)
    setEditandoNome(estagio.nome)
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setEditandoNome('')
  }

  function confirmarEdicao(id: string) {
    const nome = editandoNome.trim()
    if (!nome) {
      toast.error('O nome não pode ficar em branco.')
      return
    }
    setLista((prev) =>
      prev.map((e) => (e.id === id ? { ...e, nome } : e))
    )
    setEditandoId(null)
    startTransition(async () => {
      const result = await renomearEstagio(id, nome)
      if (result.error) {
        toast.error(result.error)
        setLista(initialEstagios) // rollback
      } else {
        toast.success('Etapa renomeada.')
        refresh()
      }
    })
  }

  // ---- tipo ----
  function handleTipo(id: string, tipo: EstagioTipo) {
    const anterior = lista.find((e) => e.id === id)?.tipo
    setLista((prev) =>
      prev.map((e) => (e.id === id ? { ...e, tipo } : e))
    )
    startTransition(async () => {
      const result = await setTipoEstagio(id, tipo)
      if (result.error) {
        toast.error(result.error)
        // rollback
        setLista((prev) =>
          prev.map((e) => (e.id === id && anterior ? { ...e, tipo: anterior } : e))
        )
      } else {
        toast.success('Tipo atualizado.')
        refresh()
      }
    })
  }

  // ---- reordenar ----
  function mover(index: number, direcao: 'up' | 'down') {
    const novaLista = [...lista]
    const alvo = direcao === 'up' ? index - 1 : index + 1
    if (alvo < 0 || alvo >= novaLista.length) return
    ;[novaLista[index], novaLista[alvo]] = [novaLista[alvo], novaLista[index]]
    setLista(novaLista)
    startTransition(async () => {
      const result = await reordenarEstagios(novaLista.map((e) => e.id))
      if (result.error) {
        toast.error(result.error)
        setLista(lista) // rollback
      } else {
        refresh()
      }
    })
  }

  // ---- remover ----
  function handleRemover(id: string) {
    startTransition(async () => {
      const result = await removerEstagio(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Etapa removida.')
        setLista((prev) => prev.filter((e) => e.id !== id))
        refresh()
      }
    })
  }

  // ---- adicionar ----
  function handleAdicionar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const nome = novoNome.trim()
    if (!nome) {
      toast.error('Informe o nome da nova etapa.')
      return
    }
    startTransition(async () => {
      const result = await criarEstagio(nome, novoTipo)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Etapa criada com sucesso.')
        setNovoNome('')
        setNovoTipo('aberto')
        refresh()
      }
    })
  }

  return (
    <div className="flex flex-col gap-5">
      {/* lista de etapas */}
      <div className="flex flex-col gap-2">
        {lista.map((estagio, index) => (
          <div
            key={estagio.id}
            className={`flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 transition-opacity ${isPending ? 'opacity-60' : ''} ${!estagio.ativo ? 'opacity-40' : ''}`}
          >
            {/* botões mover */}
            <div className="flex flex-col">
              <button
                type="button"
                aria-label="Mover para cima"
                disabled={index === 0 || isPending}
                onClick={() => mover(index, 'up')}
                className="flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronUp className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label="Mover para baixo"
                disabled={index === lista.length - 1 || isPending}
                onClick={() => mover(index, 'down')}
                className="flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronDown className="size-3.5" />
              </button>
            </div>

            {/* nome (editável inline) */}
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {editandoId === estagio.id ? (
                <div className="flex flex-1 items-center gap-1.5">
                  <Input
                    value={editandoNome}
                    onChange={(e) => setEditandoNome(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') confirmarEdicao(estagio.id)
                      if (e.key === 'Escape') cancelarEdicao()
                    }}
                    autoFocus
                    className="h-7 text-sm"
                    maxLength={80}
                  />
                  <button
                    type="button"
                    aria-label="Confirmar nome"
                    onClick={() => confirmarEdicao(estagio.id)}
                    className="flex size-6 items-center justify-center rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                  >
                    <Check className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Cancelar edição"
                    onClick={cancelarEdicao}
                    className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate text-sm text-foreground">{estagio.nome}</span>
                  {!estagio.ativo && (
                    <span className="text-xs text-muted-foreground">(inativa)</span>
                  )}
                  <button
                    type="button"
                    aria-label={`Renomear ${estagio.nome}`}
                    disabled={isPending}
                    onClick={() => iniciarEdicao(estagio)}
                    className="flex size-6 items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                  >
                    <Pencil className="size-3" />
                  </button>
                </div>
              )}
            </div>

            {/* seletor de tipo */}
            <Select
              value={estagio.tipo}
              onValueChange={(val) => handleTipo(estagio.id, val as EstagioTipo)}
              disabled={isPending}
            >
              <SelectTrigger size="sm" className="w-28 shrink-0">
                <TipoBadge tipo={estagio.tipo} />
              </SelectTrigger>
              <SelectContent>
                {TIPO_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIPO_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* remover */}
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remover etapa ${estagio.nome}`}
                    disabled={isPending}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  />
                }
              >
                <Trash2 className="size-3.5" />
              </AlertDialogTrigger>
              <AlertDialogContent size="sm">
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover etapa?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {`A etapa "${estagio.nome}" será removida. Se houver negócios vinculados, ela será desativada em vez de excluída.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => handleRemover(estagio.id)}
                  >
                    Remover
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ))}

        {lista.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma etapa cadastrada. Adicione a primeira abaixo.
          </p>
        )}
      </div>

      {/* form adicionar */}
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Plus className="size-4 text-muted-foreground" />
          <h4 className="text-sm font-medium text-foreground">Adicionar etapa</h4>
        </div>
        <form onSubmit={handleAdicionar} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="nova-etapa-nome" className="text-xs text-muted-foreground">
              Nome <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nova-etapa-nome"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Ex.: Contrato enviado"
              disabled={isPending}
              maxLength={80}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nova-etapa-tipo" className="text-xs text-muted-foreground">
              Tipo
            </Label>
            <Select
              value={novoTipo}
              onValueChange={(val) => setNovoTipo(val as EstagioTipo)}
              disabled={isPending}
            >
              <SelectTrigger id="nova-etapa-tipo" className="w-32">
                {/* label manual evita bug de SelectValue com valores não-UUID */}
                <span>{TIPO_LABEL[novoTipo]}</span>
              </SelectTrigger>
              <SelectContent>
                {TIPO_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIPO_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={isPending || !novoNome.trim()} className="shrink-0">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {isPending ? 'Salvando…' : 'Adicionar'}
          </Button>
        </form>
      </div>
    </div>
  )
}
