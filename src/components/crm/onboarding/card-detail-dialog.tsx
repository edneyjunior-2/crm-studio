'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Check } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { updateCard } from '@/app/(crm)/onboarding/actions'
import type { FluxoCard } from '@/types'

interface ClienteOption {
  id: string
  razao_social: string
}

interface CardDetailDialogProps {
  card: FluxoCard
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: (card: FluxoCard) => void
  clientes: ClienteOption[]
}

export function CardDetailDialog({ card, open, onOpenChange, onUpdated, clientes }: CardDetailDialogProps) {
  const [titulo, setTitulo] = useState(card.titulo)
  const [descricao, setDescricao] = useState(card.descricao ?? '')
  // AC2 — Campos novos
  const [clienteId, setClienteId] = useState<string>(card.cliente_id ?? '')
  // AC6 — Data limite: usar getFullYear/getMonth/getDate, nunca toISOString
  const [dataLimite, setDataLimite] = useState<string>(card.data_limite ?? '')
  const [concluido, setConcluido] = useState(card.concluido)
  const [isPending, startTransition] = useTransition()

  // Label manual do cliente selecionado (convenção Base UI Select em Dialog)
  const clienteLabel = clienteId
    ? (clientes.find((c) => c.id === clienteId)?.razao_social ?? 'Cliente selecionado')
    : 'Nenhum cliente vinculado'

  function handleSave() {
    if (!titulo.trim()) {
      toast.error('O título é obrigatório.')
      return
    }

    startTransition(async () => {
      const result = await updateCard(card.id, {
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        cliente_id: clienteId || null,
        data_limite: dataLimite || null,
        concluido,
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success('Card atualizado!')
      onUpdated({
        ...card,
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        cliente_id: clienteId || null,
        data_limite: dataLimite || null,
        concluido,
        cliente: clienteId
          ? { razao_social: clientes.find((c) => c.id === clienteId)?.razao_social ?? '' }
          : null,
      })
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
          {/* Título */}
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

          {/* Descrição */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-descricao">Descrição</Label>
            <textarea
              id="card-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Adicione uma descrição ou detalhes..."
              rows={3}
              disabled={isPending}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Cliente vinculado (AC2) — label manual no trigger, convenção Base UI Select em Dialog */}
          <div className="flex flex-col gap-1.5">
            <Label>Cliente vinculado</Label>
            <Select
              value={clienteId}
              onValueChange={(v) => setClienteId(!v || v === '__none__' ? '' : v)}
              disabled={isPending}
            >
              <SelectTrigger>
                <span className="flex flex-1 text-left line-clamp-1 text-sm">
                  {clienteLabel}
                </span>
              </SelectTrigger>
              <SelectContent className="max-h-56">
                <SelectItem value="__none__">Nenhum cliente vinculado</SelectItem>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.razao_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data limite (AC2) */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-data-limite">Data limite</Label>
            <Input
              id="card-data-limite"
              type="date"
              value={dataLimite}
              onChange={(e) => setDataLimite(e.target.value)}
              disabled={isPending}
            />
          </div>

          {/* Concluído (AC2) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConcluido((v) => !v)}
              disabled={isPending}
              className={`flex size-5 items-center justify-center rounded border-2 transition-colors ${
                concluido
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : 'border-input bg-transparent text-transparent'
              }`}
              aria-pressed={concluido}
              aria-label="Marcar como concluído"
            >
              <Check className="size-3" />
            </button>
            <Label className="cursor-pointer select-none" onClick={() => !isPending && setConcluido((v) => !v)}>
              Concluído
            </Label>
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
