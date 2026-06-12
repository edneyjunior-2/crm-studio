'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateCard } from '@/app/(crm)/fluxos/actions'
import type { FluxoCard } from '@/types'

interface CardDetailDialogProps {
  card: FluxoCard
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: (card: FluxoCard) => void
}

export function CardDetailDialog({ card, open, onOpenChange, onUpdated }: CardDetailDialogProps) {
  const [titulo, setTitulo] = useState(card.titulo)
  const [descricao, setDescricao] = useState(card.descricao ?? '')
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!titulo.trim()) {
      toast.error('O título é obrigatório.')
      return
    }

    startTransition(async () => {
      const result = await updateCard(card.id, {
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success('Card atualizado!')
      onUpdated({ ...card, titulo: titulo.trim(), descricao: descricao.trim() || null })
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Detalhes do Card</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-titulo">Título *</Label>
            <Input
              id="card-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título do card"
              disabled={isPending}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-descricao">Descrição</Label>
            <textarea
              id="card-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Adicione uma descrição ou detalhes..."
              rows={4}
              disabled={isPending}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {card.responsavel && (
            <p className="text-xs text-muted-foreground">
              Responsável: {card.responsavel.full_name}
            </p>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" disabled={isPending} />}>
            Cancelar
          </DialogClose>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
