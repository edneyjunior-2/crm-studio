'use client'

import { Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface EventoSimples {
  id?: string | null
  summary?: string | null
  start?: { dateTime?: string | null; date?: string | null } | null
  end?: { dateTime?: string | null; date?: string | null } | null
  organizer?: { email?: string | null } | null
}

interface BloqueioSimples {
  id: string
  user_id: string
  titulo: string
  data: string        // 'YYYY-MM-DD'
  hora_inicio: string // 'HH:MM:SS'
  hora_fim: string
  nomeUsuario?: string
}

interface MembroInterno {
  id: string
  nome: string
  email: string
}

interface Props {
  eventos: EventoSimples[]
  bloqueios: BloqueioSimples[]
  weekDates: string[]          // 7 strings 'YYYY-MM-DD', dom→sab
  membrosInternos: MembroInterno[]
}

const NOMES_DIAS: Record<number, string> = {
  0: 'Domingo',
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
}

/** Formata hora 'HH:MM:SS' ou 'HH:MM' → '9h' | '10h30' */
function formatarHora(hora: string): string {
  const [hStr, mStr] = hora.split(':')
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr ?? '0', 10)
  return m === 0 ? `${h}h` : `${h}h${mStr.padStart(2, '0')}`
}

/** Formata dateTime ISO → '9h' | '10h30' (fuso ignorado — pega H:M diretamente) */
function formatarDateTimeHora(dt: string): string {
  // dt pode ser '2026-06-02T10:00:00-03:00'
  const tPart = dt.split('T')[1] ?? ''
  const [hStr, mStr] = tPart.split(':')
  const h = parseInt(hStr ?? '0', 10)
  const m = parseInt(mStr ?? '0', 10)
  const mPad = mStr?.padStart(2, '0') ?? '00'
  return m === 0 ? `${h}h` : `${h}h${mPad}`
}

/** Extrai 'YYYY-MM-DD' de um dateTime ISO ou de um campo date */
function extrairData(ev: EventoSimples): string | null {
  if (ev.start?.dateTime) return ev.start.dateTime.split('T')[0]
  if (ev.start?.date) return ev.start.date
  return null
}

/** Primeiro nome de um membro interno pelo email; null se o email não for de um membro interno */
function resolverNomeInterno(email: string, membros: MembroInterno[]): string | null {
  const membro = membros.find((m) => m.email.toLowerCase() === email.toLowerCase())
  return membro ? membro.nome.split(' ')[0] : null
}

/** Ordena por horário de início (HH:MM extraído de dateTime ou hora_inicio) */
function horaOrdem(valor: string): number {
  // Para dateTime ISO: pega T parte
  if (valor.includes('T')) {
    const tPart = valor.split('T')[1] ?? '00:00'
    const [h, m] = tPart.split(':').map(Number)
    return (h ?? 0) * 60 + (m ?? 0)
  }
  // Para 'HH:MM:SS'
  const [h, m] = valor.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

type ItemDia = { ordem: number; texto: string }

function gerarTexto(
  eventos: EventoSimples[],
  bloqueios: BloqueioSimples[],
  weekDates: string[],
  membrosInternos: MembroInterno[],
): string {
  const primeiroDia = weekDates[0] // 'YYYY-MM-DD' (domingo)
  const [ano, mes, dia] = primeiroDia.split('-').map(Number)
  const diaFmt = String(dia).padStart(2, '0')
  const mesFmt = String(mes).padStart(2, '0')
  const anoFmt = String(ano).slice(2)
  const cabecalho = `Agenda da Semana ${diaFmt}/${mesFmt}/${anoFmt}`

  const linhas: string[] = [cabecalho, '']

  for (const dateStr of weekDates) {
    const [y, mo, d] = dateStr.split('-').map(Number)
    const dataObj = new Date(y, mo - 1, d)
    const diaSemanaNum = dataObj.getDay()
    const diaNome = NOMES_DIAS[diaSemanaNum]
    const diaD = String(d).padStart(2, '0')
    const mesD = String(mo).padStart(2, '0')

    const itens: ItemDia[] = []

    // --- Bloqueios do dia ---
    const bloqueiosDia = bloqueios.filter((b) => b.data === dateStr)
    for (const b of bloqueiosDia) {
      const isDiaTodo = b.hora_inicio.startsWith('09:00') && b.hora_fim.startsWith('17:00')
      const nomeResp = b.nomeUsuario
        ? b.nomeUsuario.split(' ')[0]
        : undefined

      let texto: string
      if (isDiaTodo) {
        texto = nomeResp
          ? `Dia bloqueado – ${b.titulo} – ${nomeResp}`
          : `Dia bloqueado – ${b.titulo}`
      } else {
        const inicioFmt = formatarHora(b.hora_inicio)
        const fimFmt = formatarHora(b.hora_fim)
        const rangeHora = `${inicioFmt} -${fimFmt}`
        texto = nomeResp
          ? `${rangeHora} – ${b.titulo} – ${nomeResp}`
          : `${rangeHora} – ${b.titulo}`
      }

      itens.push({ ordem: horaOrdem(b.hora_inicio), texto })
    }

    // --- Eventos Google Calendar do dia ---
    const eventosDia = eventos.filter((ev) => extrairData(ev) === dateStr)
    for (const ev of eventosDia) {
      if (!ev.summary) continue

      const startValue = ev.start?.dateTime ?? ev.start?.date ?? null
      const endValue = ev.end?.dateTime ?? ev.end?.date ?? null

      // Montar range de horário
      let rangeHora = ''
      if (ev.start?.dateTime) {
        const inicioFmt = formatarDateTimeHora(ev.start.dateTime)
        rangeHora = ev.end?.dateTime
          ? `${inicioFmt} -${formatarDateTimeHora(ev.end.dateTime)}`
          : inicioFmt
      }
      // Se for evento de dia inteiro (só date, sem dateTime), omitir horário

      // Apenas quem criou o evento (organizer), e somente se for membro interno.
      // Convidados (attendees) foram removidos a pedido — sem despejar e-mails na agenda.
      const pessoasStr = ev.organizer?.email
        ? (resolverNomeInterno(ev.organizer.email, membrosInternos) ?? '')
        : ''

      let texto: string
      if (rangeHora) {
        texto = pessoasStr
          ? `${rangeHora} – ${ev.summary} – ${pessoasStr}`
          : `${rangeHora} – ${ev.summary}`
      } else {
        // Evento de dia inteiro
        texto = pessoasStr
          ? `${ev.summary} – ${pessoasStr}`
          : ev.summary
      }

      const ordemVal = startValue
        ? horaOrdem(startValue.includes('T') ? startValue : '00:00')
        : 0

      itens.push({ ordem: ordemVal, texto })
    }

    if (itens.length === 0) continue

    // Ordenar por horário
    itens.sort((a, b) => a.ordem - b.ordem)

    linhas.push(`${diaD}/${mesD} - ${diaNome}`)
    for (const item of itens) {
      linhas.push(item.texto)
    }
    linhas.push('')
  }

  // Remover linha em branco final se existir
  while (linhas.length > 0 && linhas[linhas.length - 1] === '') {
    linhas.pop()
  }

  return linhas.join('\n')
}

export function ExportarSemanaBtn({ eventos, bloqueios, weekDates, membrosInternos }: Props) {
  async function handleExportar() {
    const texto = gerarTexto(eventos, bloqueios, weekDates, membrosInternos)
    try {
      await navigator.clipboard.writeText(texto)
      toast.success('Agenda copiada — cole no WhatsApp')
    } catch {
      toast.error('Não foi possível copiar. Verifique as permissões do navegador.')
    }
  }

  return (
    <Button variant="outline" onClick={handleExportar} className="gap-2">
      <Share2 className="size-4" />
      Exportar semana
    </Button>
  )
}
