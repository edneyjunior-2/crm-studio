'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CalendarDays, ExternalLink, Loader2, Video } from 'lucide-react'
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
import { registrarReuniaoComCalendar } from '@/app/(crm)/pipeline/atividade-actions'
import type { NegocioComRelacoes } from '@/types'

interface RegistrarReuniaoDialogProps {
  negocio: NegocioComRelacoes
  open: boolean
  onOpenChange: (open: boolean) => void
  googleConnected: boolean
}

function buildISODateTime(dateStr: string, timeStr: string): string {
  // dateStr: "YYYY-MM-DD", timeStr: "HH:MM"
  return `${dateStr}T${timeStr}:00`
}

export function RegistrarReuniaoDialog({
  negocio,
  open,
  onOpenChange,
  googleConnected,
}: RegistrarReuniaoDialogProps) {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const [isPending, startTransition] = useTransition()
  const [descricao, setDescricao] = useState('')
  const [data, setData] = useState(todayStr)
  const [horaInicio, setHoraInicio] = useState('09:00')
  const [horaFim, setHoraFim] = useState('10:00')
  const [adicionarCalendario, setAdicionarCalendario] = useState(googleConnected)
  const [googleEventUrl, setGoogleEventUrl] = useState<string | null>(null)

  function handleOpenChange(next: boolean) {
    if (!isPending) {
      onOpenChange(next)
      if (!next) {
        // Reseta ao fechar
        setDescricao('')
        setData(todayStr)
        setHoraInicio('09:00')
        setHoraFim('10:00')
        setAdicionarCalendario(googleConnected)
        setGoogleEventUrl(null)
      }
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!data) {
      toast.error('Informe a data da reunião.')
      return
    }

    const startDateTime = buildISODateTime(data, horaInicio)
    const endDateTime = buildISODateTime(data, horaFim)

    if (endDateTime <= startDateTime) {
      toast.error('O horário de término deve ser após o início.')
      return
    }

    startTransition(async () => {
      const result = await registrarReuniaoComCalendar({
        negocioId: negocio.id,
        descricao: descricao.trim() || 'Reunião registrada.',
        dataAtividade: data,
        startDateTime: adicionarCalendario ? startDateTime : undefined,
        endDateTime: adicionarCalendario ? endDateTime : undefined,
        adicionarCalendario,
        tituloEvento: `Reunião — ${negocio.titulo}`,
        descricaoEvento: negocio.clientes
          ? `Cliente: ${negocio.clientes.razao_social}\n${descricao}`
          : descricao,
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      if (result.googleEventUrl) {
        setGoogleEventUrl(result.googleEventUrl)
        toast.success('Reunião registrada e evento criado no Google Calendar.')
      } else {
        toast.success('Reunião registrada com sucesso.')
        handleOpenChange(false)
      }
    })
  }

  // Tela de sucesso com link do evento
  if (googleEventUrl) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="size-4 text-emerald-600" />
              Reunião Registrada
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-2">
            <div className="flex size-14 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200">
              <CalendarDays className="size-7 text-emerald-600" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Evento criado no Google Calendar</p>
              <p className="mt-1 text-xs text-muted-foreground">
                A reunião foi adicionada ao seu calendário.
              </p>
            </div>
            <a
              href={googleEventUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/70 transition-colors"
            >
              <ExternalLink className="size-3.5" />
              Ver no Google Calendar
            </a>
          </div>

          <DialogFooter>
            <Button onClick={() => handleOpenChange(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="size-4 text-violet-600" />
            Registrar Reunião
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Negócio: <strong className="text-foreground">{negocio.titulo}</strong>
            {negocio.clientes && (
              <> · <span>{negocio.clientes.razao_social}</span></>
            )}
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`reuniao-data-${negocio.id}`}>
              Data <span className="text-destructive">*</span>
            </Label>
            <Input
              id={`reuniao-data-${negocio.id}`}
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`reuniao-inicio-${negocio.id}`}>Início</Label>
              <Input
                id={`reuniao-inicio-${negocio.id}`}
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`reuniao-fim-${negocio.id}`}>Término</Label>
              <Input
                id={`reuniao-fim-${negocio.id}`}
                type="time"
                value={horaFim}
                onChange={(e) => setHoraFim(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`reuniao-obs-${negocio.id}`}>Notas (opcional)</Label>
            <Textarea
              id={`reuniao-obs-${negocio.id}`}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Apresentação da proposta, alinhamento de escopo..."
              rows={3}
            />
          </div>

          {/* Toggle Google Calendar */}
          <div className={`flex items-start gap-3 rounded-xl border p-3 ${
            googleConnected
              ? 'border-border bg-muted/40'
              : 'border-border/50 bg-muted/20 opacity-70'
          }`}>
            <Switch
              id={`reuniao-calendar-${negocio.id}`}
              checked={adicionarCalendario}
              onCheckedChange={(v) => { if (googleConnected) setAdicionarCalendario(v) }}
              disabled={!googleConnected}
            />
            <div className="flex flex-col gap-0.5">
              <Label
                htmlFor={`reuniao-calendar-${negocio.id}`}
                className="text-sm font-medium cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-3.5 text-muted-foreground" />
                  Adicionar ao Google Calendar
                </span>
              </Label>
              {googleConnected ? (
                <p className="text-xs text-muted-foreground">
                  Cria um evento no seu calendário pessoal
                </p>
              ) : (
                <p className="text-xs text-amber-600">
                  Conecte seu Google Calendar em{' '}
                  <a href="/minha-conta" className="underline underline-offset-2 hover:text-amber-700">
                    Minha Conta
                  </a>
                </p>
              )}
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
                  Registrando...
                </>
              ) : (
                'Registrar reunião'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
