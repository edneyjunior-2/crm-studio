'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CalendarPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { criarBloqueio } from '@/app/(crm)/calendario/actions'

const TIME_OPTIONS = Array.from({ length: 24 * 12 }, (_, i) => {
  const h = Math.floor(i / 12).toString().padStart(2, '0')
  const m = ((i % 12) * 5).toString().padStart(2, '0')
  return `${h}:${m}`
})

function TimeSelect({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required
      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
    >
      <option value="" disabled>HH:MM</option>
      {TIME_OPTIONS.map((t) => (
        <option key={t} value={t}>{t}</option>
      ))}
    </select>
  )
}

function addOneHour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const newH = (h + 1) % 24
  return `${newH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

function hojeFormatado(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  return `${y}-${m}-${day}`
}

interface Props {
  defaultDate?: string
  open?: boolean
  onOpenChange?: (v: boolean) => void
}

export function NovoBloqueioDialog({ defaultDate, open: openProp, onOpenChange }: Props) {
  const router = useRouter()
  const isControlled = openProp !== undefined
  const [openInternal, setOpenInternal] = useState(false)
  const open = isControlled ? openProp : openInternal

  function setOpen(v: boolean) {
    if (isControlled) onOpenChange?.(v)
    else setOpenInternal(v)
  }

  const [isPending, startTransition] = useTransition()
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [data, setData] = useState('')
  const [horaInicio, setHoraInicio] = useState('09:00')
  const [horaFim, setHoraFim] = useState('10:00')
  const [recorrencia, setRecorrencia] = useState('none')

  useEffect(() => {
    if (open) {
      setData(defaultDate ?? hojeFormatado())
    }
  }, [open, defaultDate])

  function handleInicioChange(val: string) {
    setHoraInicio(val)
    setHoraFim(addOneHour(val))
  }

  function resetForm() {
    setTitulo('')
    setDescricao('')
    setData('')
    setHoraInicio('09:00')
    setHoraFim('10:00')
    setRecorrencia('none')
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!data) {
      toast.error('Informe a data do evento')
      return
    }

    if (horaFim <= horaInicio) {
      toast.error('O horário de término deve ser posterior ao início')
      return
    }

    const payload = new FormData()
    payload.set('titulo', titulo)
    payload.set('descricao', descricao)
    payload.set('data', data)
    payload.set('hora_inicio', horaInicio)
    payload.set('hora_fim', horaFim)
    payload.set('recorrencia', recorrencia)

    startTransition(async () => {
      const result = await criarBloqueio(payload)
      if (result.error) {
        toast.error(result.error)
        return
      }
      const mensagem =
        recorrencia === 'semanal'
          ? 'Agenda criada — 26 ocorrências semanais'
          : recorrencia === 'mensal'
          ? 'Agenda criada — 12 ocorrências mensais'
          : 'Agenda adicionada ao calendário'
      toast.success(mensagem)
      resetForm()
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      {!isControlled && (
        <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
          <CalendarPlus className="size-4" />
          Agenda
        </Button>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agenda</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bloqueio-titulo">
                Título <span className="text-destructive">*</span>
              </Label>
              <Input
                id="bloqueio-titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Consulta médica, compromisso pessoal..."
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bloqueio-descricao">Descrição</Label>
              <Textarea
                id="bloqueio-descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Detalhes ou observações..."
                rows={2}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bloqueio-data">
                Data <span className="text-destructive">*</span>
              </Label>
              <Input
                id="bloqueio-data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bloqueio-inicio">
                  Início <span className="text-destructive">*</span>
                </Label>
                <TimeSelect
                  id="bloqueio-inicio"
                  value={horaInicio}
                  onChange={handleInicioChange}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bloqueio-fim">
                  Término <span className="text-destructive">*</span>
                </Label>
                <TimeSelect
                  id="bloqueio-fim"
                  value={horaFim}
                  onChange={setHoraFim}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bloqueio-recorrencia">Repetição</Label>
              <select
                id="bloqueio-recorrencia"
                value={recorrencia}
                onChange={(e) => setRecorrencia(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="none">Não repetir</option>
                <option value="semanal">Semanalmente (26 semanas)</option>
                <option value="mensal">Mensalmente (12 meses)</option>
              </select>
            </div>

            <p className="text-xs text-muted-foreground">
              O evento aparece no calendário da empresa para que todos saibam que você está ocupado neste horário.
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setOpen(false); resetForm() }}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>

          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
