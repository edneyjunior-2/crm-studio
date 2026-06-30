'use client'

import { useState, useTransition, useId } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Bell, CalendarClock, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { criarLembrete } from '@/app/(crm)/pipeline/followup-actions'

interface BotaoLembreteProps {
  negocioId: string
  clienteNome: string
  variant?: 'ghost' | 'outline' | 'default'
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function BotaoLembrete({ negocioId, clienteNome, variant = 'ghost' }: BotaoLembreteProps) {
  const router = useRouter()
  const uid = useId()

  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [data, setData] = useState(todayStr())
  const [hora, setHora] = useState('09:00')
  const [observacao, setObservacao] = useState('')
  const [adicionarCalendario, setAdicionarCalendario] = useState(true)
  const [successUrl, setSuccessUrl] = useState<string | null>(null)

  function resetForm() {
    setData(todayStr())
    setHora('09:00')
    setObservacao('')
    setAdicionarCalendario(true)
    setSuccessUrl(null)
  }

  function handleOpenChange(next: boolean) {
    if (isPending) return
    setOpen(next)
    if (!next) resetForm()
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!data) {
      toast.error('Informe a data do lembrete.')
      return
    }

    startTransition(async () => {
      const result = await criarLembrete({
        negocioId,
        data,
        hora,
        observacao: observacao.trim() || undefined,
        adicionarCalendario,
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      if (result.googleEventUrl) {
        setSuccessUrl(result.googleEventUrl)
        toast.success('Lembrete criado e evento adicionado ao Google Calendar.', {
          action: {
            label: 'Abrir no Google',
            onClick: () => window.open(result.googleEventUrl!, '_blank'),
          },
        })
      } else {
        toast.success('Lembrete criado com sucesso.')
        handleOpenChange(false)
        router.refresh()
      }
    })
  }

  // Tela de sucesso com link
  if (successUrl && open) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="size-4 text-amber-500" />
              Lembrete Criado
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-2">
            <div className="flex size-14 items-center justify-center rounded-full bg-amber-50 border border-amber-200">
              <CalendarClock className="size-7 text-amber-500" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Evento criado no Google Calendar</p>
              <p className="mt-1 text-xs text-muted-foreground">
                O lembrete foi adicionado ao seu calendário.
              </p>
            </div>
            <a
              href={successUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/70 transition-colors"
            >
              <ExternalLink className="size-3.5" />
              Ver no Google Calendar
            </a>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                handleOpenChange(false)
                router.refresh()
              }}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <>
      <Button
        variant={variant}
        size="icon-sm"
        className="opacity-0 transition-opacity group-hover:opacity-100 text-amber-500 hover:bg-amber-500/10 hover:text-amber-600"
        onClick={() => setOpen(true)}
        aria-label="Criar lembrete"
        type="button"
      >
        <Bell className="size-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="size-4 text-amber-500" />
              Criar Lembrete
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Lembrete para:{' '}
              <strong className="text-foreground">{clienteNome}</strong>
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${uid}-data`}>
                  Data <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={`${uid}-data`}
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${uid}-hora`}>Hora</Label>
                <Input
                  id={`${uid}-hora`}
                  type="time"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${uid}-obs`}>Observação</Label>
              <Textarea
                id={`${uid}-obs`}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder={`Falar com ${clienteNome} — retomar processo`}
                rows={3}
              />
            </div>

            {/* Toggle Google Calendar */}
            <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-3">
              <Switch
                id={`${uid}-calendar`}
                checked={adicionarCalendario}
                onCheckedChange={(v) => setAdicionarCalendario(v)}
              />
              <div className="flex flex-col gap-0.5">
                <Label
                  htmlFor={`${uid}-calendar`}
                  className="text-sm font-medium cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <CalendarClock className="size-3.5 text-muted-foreground" />
                    Adicionar ao meu Google Calendar
                  </span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  Cria um evento de 30 min no seu calendário pessoal
                </p>
              </div>
            </div>

            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                Cancelar
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar lembrete'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
