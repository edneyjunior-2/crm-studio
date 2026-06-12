'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Plus,
  X,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Trash2,
  LayoutTemplate,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { FluxoForm } from './fluxo-form'
import { CardDetailDialog } from './card-detail-dialog'
import {
  createColuna,
  updateColuna,
  deleteColuna,
  createCard,
  moveCard,
  deleteCard,
} from '@/app/(crm)/fluxos/actions'
import type { Fluxo, FluxoColuna, FluxoCard } from '@/types'

// 10 cores pré-definidas para status
const CORES_PRESET = [
  { label: 'Cinza', value: '#6B7280' },
  { label: 'Azul', value: '#3B82F6' },
  { label: 'Verde', value: '#22C55E' },
  { label: 'Amarelo', value: '#EAB308' },
  { label: 'Laranja', value: '#F97316' },
  { label: 'Vermelho', value: '#EF4444' },
  { label: 'Roxo', value: '#A855F7' },
  { label: 'Rosa', value: '#EC4899' },
  { label: 'Ciano', value: '#06B6D4' },
  { label: 'Esmeralda', value: '#10B981' },
]

interface FluxoKanbanViewProps {
  fluxo: Fluxo
  isOwnerOrAdmin: boolean
}

export function FluxoKanbanView({ fluxo: initialFluxo, isOwnerOrAdmin }: FluxoKanbanViewProps) {
  const router = useRouter()
  const [colunas, setColunas] = useState<FluxoColuna[]>(initialFluxo.colunas ?? [])
  const [, startTransition] = useTransition()

  // Estado para nova coluna inline
  const [addingColuna, setAddingColuna] = useState(false)
  const [novaColunaTitulo, setNovaColunaTitulo] = useState('')
  const [novaColunaCorIndex, setNovaColunaCorIndex] = useState(0)
  const [savingColuna, setSavingColuna] = useState(false)
  const novaColunaTituloRef = useRef<HTMLInputElement>(null)

  // Estado para edição inline de título de coluna
  const [editingColunaId, setEditingColunaId] = useState<string | null>(null)
  const [editingColunaTitulo, setEditingColunaTitulo] = useState('')

  // Estado para cor picker de coluna
  const [colorPickerColunaId, setColorPickerColunaId] = useState<string | null>(null)

  // Estado para adicionar card inline
  const [addingCardColunaId, setAddingCardColunaId] = useState<string | null>(null)
  const [novoCardTitulo, setNovoCardTitulo] = useState('')
  const [savingCard, setSavingCard] = useState(false)
  const novoCardRef = useRef<HTMLInputElement>(null)

  // Estado para card detail dialog
  const [selectedCard, setSelectedCard] = useState<FluxoCard | null>(null)
  const [cardDialogOpen, setCardDialogOpen] = useState(false)

  // Estado para confirmação de deleção
  const [deleteTarget, setDeleteTarget] = useState<
    | { type: 'coluna'; id: string; titulo: string }
    | { type: 'card'; id: string; titulo: string }
    | null
  >(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  // Estado para deleção do board
  const [deletingBoard, setDeletingBoard] = useState(false)

  const canManage = isOwnerOrAdmin

  useEffect(() => {
    if (addingColuna) {
      setTimeout(() => novaColunaTituloRef.current?.focus(), 50)
    }
  }, [addingColuna])

  useEffect(() => {
    if (addingCardColunaId) {
      setTimeout(() => novoCardRef.current?.focus(), 50)
    }
  }, [addingCardColunaId])

  // ─── Colunas ───────────────────────────────────────────────────────────────

  async function handleSaveColuna() {
    if (!novaColunaTitulo.trim()) return
    setSavingColuna(true)

    const result = await createColuna(
      initialFluxo.id,
      novaColunaTitulo.trim(),
      CORES_PRESET[novaColunaCorIndex].value
    )

    setSavingColuna(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    // Optimistic update via router refresh
    toast.success('Coluna criada!')
    setAddingColuna(false)
    setNovaColunaTitulo('')
    setNovaColunaCorIndex(0)
    router.refresh()
  }

  function handleStartEditColuna(coluna: FluxoColuna) {
    setEditingColunaId(coluna.id)
    setEditingColunaTitulo(coluna.titulo)
    setColorPickerColunaId(null)
  }

  async function handleSaveEditColuna(coluna: FluxoColuna) {
    if (!editingColunaTitulo.trim()) {
      setEditingColunaId(null)
      return
    }

    if (editingColunaTitulo.trim() === coluna.titulo) {
      setEditingColunaId(null)
      return
    }

    startTransition(async () => {
      const result = await updateColuna(coluna.id, editingColunaTitulo.trim(), coluna.cor)
      if (result.error) {
        toast.error(result.error)
      } else {
        setColunas((prev) =>
          prev.map((c) =>
            c.id === coluna.id ? { ...c, titulo: editingColunaTitulo.trim() } : c
          )
        )
      }
      setEditingColunaId(null)
    })
  }

  async function handleChangeColunaColor(coluna: FluxoColuna, cor: string) {
    setColorPickerColunaId(null)
    setColunas((prev) =>
      prev.map((c) => (c.id === coluna.id ? { ...c, cor } : c))
    )

    startTransition(async () => {
      const result = await updateColuna(coluna.id, coluna.titulo, cor)
      if (result.error) {
        toast.error(result.error)
        setColunas((prev) =>
          prev.map((c) => (c.id === coluna.id ? { ...c, cor: coluna.cor } : c))
        )
      }
    })
  }

  function handleDeleteColuna(coluna: FluxoColuna) {
    setDeleteTarget({ type: 'coluna', id: coluna.id, titulo: coluna.titulo })
    setDeleteConfirmOpen(true)
  }

  // ─── Cards ─────────────────────────────────────────────────────────────────

  async function handleSaveCard(colunaId: string) {
    if (!novoCardTitulo.trim()) {
      setAddingCardColunaId(null)
      return
    }
    setSavingCard(true)

    const result = await createCard(colunaId, initialFluxo.id, novoCardTitulo.trim())

    setSavingCard(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    setAddingCardColunaId(null)
    setNovoCardTitulo('')
    router.refresh()
  }

  async function handleMoveCard(card: FluxoCard, direction: 'left' | 'right') {
    const colIndex = colunas.findIndex((c) => c.id === card.coluna_id)
    if (colIndex === -1) return

    const targetIndex = direction === 'left' ? colIndex - 1 : colIndex + 1
    if (targetIndex < 0 || targetIndex >= colunas.length) return

    const targetColuna = colunas[targetIndex]

    // Optimistic update
    setColunas((prev) =>
      prev.map((col) => {
        if (col.id === card.coluna_id) {
          return { ...col, cards: (col.cards ?? []).filter((c) => c.id !== card.id) }
        }
        if (col.id === targetColuna.id) {
          return { ...col, cards: [...(col.cards ?? []), { ...card, coluna_id: targetColuna.id }] }
        }
        return col
      })
    )

    startTransition(async () => {
      const result = await moveCard(card.id, targetColuna.id)
      if (result.error) {
        toast.error(result.error)
        router.refresh()
      }
    })
  }

  function handleOpenCardDetail(card: FluxoCard) {
    setSelectedCard(card)
    setCardDialogOpen(true)
  }

  function handleCardUpdated(updated: FluxoCard) {
    setColunas((prev) =>
      prev.map((col) => ({
        ...col,
        cards: (col.cards ?? []).map((c) => (c.id === updated.id ? updated : c)),
      }))
    )
  }

  function handleDeleteCard(card: FluxoCard) {
    setDeleteTarget({ type: 'card', id: card.id, titulo: card.titulo })
    setDeleteConfirmOpen(true)
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setDeleteConfirmOpen(false)
    setDeletingBoard(true)

    let result: { error?: string }

    if (deleteTarget.type === 'coluna') {
      result = await deleteColuna(deleteTarget.id)
    } else {
      result = await deleteCard(deleteTarget.id)
    }

    setDeletingBoard(false)
    setDeleteTarget(null)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(deleteTarget.type === 'coluna' ? 'Coluna removida.' : 'Card removido.')
      router.refresh()
    }
  }

  // Sincroniza colunas quando o fluxo recarrega via router.refresh()
  useEffect(() => {
    setColunas(initialFluxo.colunas ?? [])
  }, [initialFluxo])

  return (
    <div className="flex flex-col gap-4 min-h-0">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/fluxos" className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'shrink-0')}>
            <ArrowLeft className="size-4" />
          </Link>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-foreground font-[family-name:var(--font-heading)]">
                {initialFluxo.titulo}
              </h2>
              <Badge
                variant={initialFluxo.visibilidade === 'todos_comerciais' ? 'default' : 'secondary'}
                className="text-[11px]"
              >
                {initialFluxo.visibilidade === 'todos_comerciais' ? 'Compartilhado' : 'Privado'}
              </Badge>
            </div>
            {initialFluxo.descricao && (
              <p className="text-sm text-muted-foreground">{initialFluxo.descricao}</p>
            )}
          </div>
        </div>

        {canManage && (
          <FluxoForm
            fluxo={initialFluxo}
            trigger={
              <Button variant="outline" size="sm">
                <Pencil className="size-3.5" />
                Editar
              </Button>
            }
            onSuccess={() => router.refresh()}
          />
        )}
      </div>

      {/* Kanban horizontal */}
      <div className="flex gap-3 overflow-x-auto pb-4 min-h-[60vh]">
        {colunas.map((coluna, colIndex) => {
          const cards = coluna.cards ?? []

          return (
            <div
              key={coluna.id}
              className="flex w-72 shrink-0 flex-col rounded-xl border border-border bg-muted/30"
            >
              {/* Coluna Header */}
              <div className="flex items-center gap-2 px-3 py-2.5">
                {/* Color dot */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      if (!canManage) return
                      setColorPickerColunaId(
                        colorPickerColunaId === coluna.id ? null : coluna.id
                      )
                    }}
                    className={cn(
                      'size-3 rounded-full shrink-0 transition-transform',
                      canManage && 'cursor-pointer hover:scale-125'
                    )}
                    style={{ backgroundColor: coluna.cor }}
                    title={canManage ? 'Clique para mudar a cor' : undefined}
                  />
                  {colorPickerColunaId === coluna.id && (
                    <div className="absolute left-0 top-5 z-50 flex flex-col gap-1.5 rounded-xl border border-border bg-popover p-2.5 shadow-md">
                      <p className="text-[11px] font-medium text-muted-foreground mb-0.5">
                        Cor do status
                      </p>
                      <div className="grid grid-cols-5 gap-1.5">
                        {CORES_PRESET.map((cor) => (
                          <button
                            key={cor.value}
                            type="button"
                            title={cor.label}
                            onClick={() => handleChangeColunaColor(coluna, cor.value)}
                            className={cn(
                              'size-5 rounded-full border-2 transition-transform hover:scale-125',
                              coluna.cor === cor.value
                                ? 'border-foreground'
                                : 'border-transparent'
                            )}
                            style={{ backgroundColor: cor.value }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Título inline edit */}
                <div className="flex flex-1 min-w-0">
                  {editingColunaId === coluna.id ? (
                    <Input
                      autoFocus
                      value={editingColunaTitulo}
                      onChange={(e) => setEditingColunaTitulo(e.target.value)}
                      onBlur={() => handleSaveEditColuna(coluna)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEditColuna(coluna)
                        if (e.key === 'Escape') setEditingColunaId(null)
                      }}
                      className="h-6 px-1.5 py-0 text-sm font-semibold"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => canManage && handleStartEditColuna(coluna)}
                      className={cn(
                        'flex-1 truncate text-left text-sm font-semibold text-foreground',
                        canManage && 'cursor-pointer hover:text-foreground/70'
                      )}
                      title={canManage ? 'Clique para editar o título' : undefined}
                    >
                      {coluna.titulo}
                    </button>
                  )}
                </div>

                {/* Contador */}
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground shrink-0">
                  {cards.length}
                </span>

                {/* Delete coluna */}
                {canManage && (
                  <button
                    type="button"
                    onClick={() => handleDeleteColuna(coluna)}
                    className="shrink-0 rounded p-0.5 text-muted-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive"
                    title="Remover coluna"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Cards */}
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2 pt-0">
                {cards.length === 0 && !addingCardColunaId && (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/20 py-8 text-center">
                    <LayoutTemplate className="mb-1.5 size-6 text-muted-foreground/25" />
                    <p className="text-xs text-muted-foreground/50">Nenhum card</p>
                  </div>
                )}

                {cards.map((card) => (
                  <div
                    key={card.id}
                    className="group/card relative flex flex-col gap-1.5 rounded-lg border border-border bg-card px-3 py-2.5 shadow-xs transition-shadow hover:shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => handleOpenCardDetail(card)}
                      className="text-left text-sm font-medium text-foreground hover:text-foreground/80"
                    >
                      {card.titulo}
                    </button>

                    {card.descricao && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {card.descricao}
                      </p>
                    )}

                    {card.responsavel && (
                      <p className="text-[11px] text-muted-foreground/60">
                        {card.responsavel.full_name}
                      </p>
                    )}

                    {/* Ações do card */}
                    <div className="flex items-center justify-between mt-0.5">
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          disabled={colIndex === 0}
                          onClick={() => handleMoveCard(card, 'left')}
                          className={cn(
                            'rounded p-0.5 transition-colors',
                            colIndex === 0
                              ? 'cursor-not-allowed text-muted-foreground/20'
                              : 'text-muted-foreground/40 hover:bg-muted hover:text-foreground/70'
                          )}
                          title="Mover para coluna anterior"
                        >
                          <ChevronLeft className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={colIndex === colunas.length - 1}
                          onClick={() => handleMoveCard(card, 'right')}
                          className={cn(
                            'rounded p-0.5 transition-colors',
                            colIndex === colunas.length - 1
                              ? 'cursor-not-allowed text-muted-foreground/20'
                              : 'text-muted-foreground/40 hover:bg-muted hover:text-foreground/70'
                          )}
                          title="Mover para próxima coluna"
                        >
                          <ChevronRight className="size-3.5" />
                        </button>
                      </div>

                      {canManage && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCard(card)}
                          className="rounded p-0.5 text-muted-foreground/30 transition-colors hover:bg-destructive/10 hover:text-destructive"
                          title="Remover card"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Input inline novo card */}
                {addingCardColunaId === coluna.id && (
                  <div className="flex flex-col gap-1.5">
                    <Input
                      ref={novoCardRef}
                      value={novoCardTitulo}
                      onChange={(e) => setNovoCardTitulo(e.target.value)}
                      placeholder="Título do card..."
                      disabled={savingCard}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveCard(coluna.id)
                        if (e.key === 'Escape') {
                          setAddingCardColunaId(null)
                          setNovoCardTitulo('')
                        }
                      }}
                      className="h-8 text-sm"
                    />
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        disabled={savingCard}
                        onClick={() => handleSaveCard(coluna.id)}
                      >
                        {savingCard ? 'Salvando...' : 'Adicionar'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        disabled={savingCard}
                        onClick={() => {
                          setAddingCardColunaId(null)
                          setNovoCardTitulo('')
                        }}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer — adicionar card */}
              {addingCardColunaId !== coluna.id && (
                <div className="p-2 pt-0">
                  <button
                    type="button"
                    onClick={() => {
                      setNovoCardTitulo('')
                      setAddingCardColunaId(coluna.id)
                    }}
                    className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground/70"
                  >
                    <Plus className="size-3.5" />
                    Adicionar card
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {/* Botão / form para nova coluna */}
        {canManage && (
          <div className="flex shrink-0 flex-col">
            {addingColuna ? (
              <div className="flex w-64 flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3">
                <p className="text-xs font-medium text-foreground">Nova coluna</p>
                <Input
                  ref={novaColunaTituloRef}
                  value={novaColunaTitulo}
                  onChange={(e) => setNovaColunaTitulo(e.target.value)}
                  placeholder="Nome do status..."
                  disabled={savingColuna}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveColuna()
                    if (e.key === 'Escape') {
                      setAddingColuna(false)
                      setNovaColunaTitulo('')
                    }
                  }}
                  className="h-8 text-sm"
                />

                {/* Seleção de cor */}
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] text-muted-foreground">Cor do status</p>
                  <div className="flex flex-wrap gap-1.5">
                    {CORES_PRESET.map((cor, i) => (
                      <button
                        key={cor.value}
                        type="button"
                        title={cor.label}
                        onClick={() => setNovaColunaCorIndex(i)}
                        className={cn(
                          'size-5 rounded-full border-2 transition-transform hover:scale-125',
                          novaColunaCorIndex === i
                            ? 'border-foreground'
                            : 'border-transparent'
                        )}
                        style={{ backgroundColor: cor.value }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    disabled={savingColuna}
                    onClick={handleSaveColuna}
                  >
                    {savingColuna ? 'Salvando...' : 'Criar coluna'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={savingColuna}
                    onClick={() => {
                      setAddingColuna(false)
                      setNovaColunaTitulo('')
                    }}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingColuna(true)}
                className="flex h-10 w-48 items-center gap-2 rounded-xl border border-dashed border-border px-3 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted/30 hover:text-foreground/70"
              >
                <Plus className="size-4" />
                Adicionar coluna
              </button>
            )}
          </div>
        )}

        {colunas.length === 0 && !addingColuna && (
          <div className="flex w-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/10 py-20 text-center">
            <div className="flex flex-col items-center gap-3">
              <LayoutTemplate className="size-12 text-muted-foreground/25" />
              <p className="text-sm text-muted-foreground">
                {canManage
                  ? 'Nenhuma coluna ainda. Clique em "Adicionar coluna" para começar.'
                  : 'Nenhuma coluna foi criada neste fluxo.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Card detail dialog */}
      {selectedCard && (
        <CardDetailDialog
          card={selectedCard}
          open={cardDialogOpen}
          onOpenChange={setCardDialogOpen}
          onUpdated={handleCardUpdated}
        />
      )}

      {/* Confirm delete dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.type === 'coluna' ? 'Remover coluna?' : 'Remover card?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === 'coluna'
                ? `A coluna "${deleteTarget?.titulo}" e todos os seus cards serão removidos permanentemente. Esta ação não pode ser desfeita.`
                : `O card "${deleteTarget?.titulo}" será removido permanentemente. Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingBoard}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deletingBoard}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingBoard ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
