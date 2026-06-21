'use client'

import { useState } from 'react'
import { Calendar, CheckCircle2, Loader2, Video } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { agendarAudienciaNoCalendario } from './actions'

export interface MembroInterno {
  id:    string
  nome:  string
  email: string
}

interface Props {
  descricao:      string
  dataSugerida:   string   // YYYY-MM-DD
  processoNumero: string
  vara:           string | null
  comarca:        string | null
  clienteNome:    string | null
  areaLabel:      string | null
  advogadoEmail:  string | null
  membros:        MembroInterno[]
}

const DURACOES = [
  { label: '30 min', value: 30 },
  { label: '1 hora', value: 60 },
  { label: '1h 30', value: 90 },
  { label: '2 horas', value: 120 },
  { label: '3 horas', value: 180 },
]

export function AgendarAudienciaDialog({
  descricao, dataSugerida, processoNumero,
  vara, comarca, clienteNome, areaLabel, advogadoEmail, membros,
}: Props) {
  const localPadrao = [vara, comarca].filter(Boolean).join(' — ')
  const descricaoPadrao = [
    `Processo: ${processoNumero}`,
    clienteNome  ? `Cliente: ${clienteNome}`  : null,
    areaLabel    ? `Área: ${areaLabel}`        : null,
    vara         ? `Vara: ${vara}`             : null,
    comarca      ? `Comarca: ${comarca}`       : null,
  ].filter(Boolean).join('\n')

  // Pré-seleciona o advogado responsável
  const emailsIniciais = new Set<string>(advogadoEmail ? [advogadoEmail] : [])

  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [meetLink, setMeetLink] = useState<string | null>(null)
  const [erro,    setErro]    = useState<string | null>(null)

  const [titulo,     setTitulo]     = useState(`Audiência — ${descricao} — Processo ${processoNumero}`)
  const [data,       setData]       = useState(dataSugerida)
  const [hora,       setHora]       = useState('09:00')
  const [duracao,    setDuracao]    = useState(60)
  const [local,      setLocal]      = useState(localPadrao)
  const [descricaoEvento, setDescricao] = useState(descricaoPadrao)
  const [selecionados, setSelecionados] = useState<Set<string>>(emailsIniciais)

  function toggleMembro(email: string) {
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (next.has(email)) next.delete(email)
      else next.add(email)
      return next
    })
  }

  function handleOpen() {
    setErro(null)
    setSucesso(false)
    setMeetLink(null)
    setOpen(true)
  }

  async function handleConfirmar() {
    if (!data || !hora) { setErro('Informe a data e a hora.'); return }
    setErro(null)
    setLoading(true)

    const dataHoraInicio = new Date(`${data}T${hora}:00-03:00`).toISOString()

    const res = await agendarAudienciaNoCalendario({
      titulo,
      dataHoraInicio,
      duracaoMinutos: duracao,
      local,
      descricao:      descricaoEvento,
      attendeeEmails: Array.from(selecionados),
    })

    setLoading(false)
    if (res.error) {
      setErro(res.error)
    } else {
      setSucesso(true)
      setMeetLink(res.meetLink ?? null)
    }
  }

  const inputClass = 'h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-foreground/40'

  if (sucesso) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-2 rounded-lg border border-chart-5/30 bg-chart-5/10 px-3 py-2 text-sm text-chart-5">
          <CheckCircle2 className="size-4 shrink-0" />
          Audiência agendada no calendário
        </div>
        {meetLink && (
          <a
            href={meetLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary underline underline-offset-2"
          >
            <Video className="size-3.5" />
            Abrir link do Meet
          </a>
        )}
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50 dark:border-amber-700 dark:bg-transparent dark:text-amber-300"
      >
        <Calendar className="size-3.5" />
        Agendar no calendário
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Agendar audiência</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-1">
            {/* Título */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Título do evento *</label>
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className={inputClass}
              />
            </div>

            {/* Data · Hora · Duração */}
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Data *</label>
                <input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Hora início *</label>
                <input
                  type="time"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Duração</label>
                <select
                  value={duracao}
                  onChange={(e) => setDuracao(Number(e.target.value))}
                  className={inputClass}
                >
                  {DURACOES.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Local */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Local</label>
              <input
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                placeholder="Vara, comarca ou endereço"
                className={inputClass}
              />
            </div>

            {/* Participantes */}
            {membros.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Participantes</label>
                <div className="flex max-h-36 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2">
                  {membros.map((m) => {
                    const selecionado = selecionados.has(m.email)
                    return (
                      <label
                        key={m.email}
                        className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60"
                      >
                        <input
                          type="checkbox"
                          checked={selecionado}
                          onChange={() => toggleMembro(m.email)}
                          className="size-3.5 rounded accent-primary"
                        />
                        <span className="text-sm text-foreground">{m.nome}</span>
                        <span className="ml-auto text-[11px] text-muted-foreground">{m.email}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Descrição */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Descrição</label>
              <textarea
                value={descricaoEvento}
                onChange={(e) => setDescricao(e.target.value)}
                rows={4}
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-foreground/40"
              />
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
              onClick={handleConfirmar}
              disabled={loading || !titulo.trim() || !data || !hora}
              className="h-9 rounded-lg bg-foreground px-4 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : 'Agendar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
