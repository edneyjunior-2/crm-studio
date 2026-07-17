/**
 * Grade fixa de horários do agendamento real da Leila (SDR) — seg-sex, hora
 * cheia das 9h às 16h (último slot começa às 16h e termina às 17h), 1h de
 * duração. Compartilhado por GET /api/leads/disponibilidade (gera candidatos)
 * e POST /api/leads/reuniao (RE-VALIDA o slot escolhido usando as MESMAS
 * funções — nunca confia no que foi oferecido antes; ver AC2/AC3 da spec
 * sdr-agendamento-real.md).
 *
 * América/São_Paulo não observa horário de verão desde 2019 — por isso um
 * offset fixo `-03:00` é seguro aqui (mesma premissa já usada em
 * src/lib/google/calendar.ts e src/app/(crm)/calendario/actions.ts).
 */

export const TZ_OFFSET = '-03:00'

/** Início de cada slot de 1h. */
export const HORAS_SLOT = [9, 10, 11, 12, 13, 14, 15, 16] as const

export interface Slot {
  /** ISO com offset -03:00, sempre em hora cheia. */
  inicio: string
  /** inicio + 1h. */
  fim: string
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function isoSlot(ano: number, mes: number, dia: number, hora: number): string {
  return `${ano}-${pad2(mes)}-${pad2(dia)}T${pad2(hora)}:00:00${TZ_OFFSET}`
}

/** ano/mês/dia/hora/dia-da-semana (0=dom..6=sáb) na wall-clock de São Paulo, a partir de um instante. */
function partesEmSaoPaulo(ms: number): { ano: number; mes: number; dia: number; hora: number; diaSemana: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hour12: false, weekday: 'short',
  })
  const partes = fmt.formatToParts(new Date(ms))
  const get = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? ''
  const diaSemanaMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return {
    ano: Number(get('year')),
    mes: Number(get('month')),
    dia: Number(get('day')),
    // Intl com hour12:false pode devolver "24" à meia-noite — normaliza pra 0.
    hora: Number(get('hour')) % 24,
    diaSemana: diaSemanaMap[get('weekday')] ?? -1,
  }
}

/**
 * Gera a grade de slots candidatos (seg-sex, hora cheia 9-16h) cobrindo
 * `diasUteis` dias úteis à frente a partir de `agoraMs`. Pula slots que
 * começariam a menos de 1h do momento atual (não oferece "daqui a 5 min").
 */
export function gerarGradeSlots(diasUteis: number, agoraMs: number = Date.now()): Slot[] {
  const slots: Slot[] = []
  const bufferMs = 60 * 60 * 1000
  let diasEncontrados = 0
  let offsetDias = 0

  // Limite de segurança (evita loop infinito) — nunca deveria precisar passar
  // de ~8 semanas corridas pra achar `diasUteis` dias úteis.
  while (diasEncontrados < diasUteis && offsetDias < 60) {
    const candidatoMs = agoraMs + offsetDias * 24 * 60 * 60 * 1000
    const { ano, mes, dia, diaSemana } = partesEmSaoPaulo(candidatoMs)
    offsetDias++
    if (diaSemana === 0 || diaSemana === 6) continue // fim de semana
    diasEncontrados++

    for (const hora of HORAS_SLOT) {
      const inicio = isoSlot(ano, mes, dia, hora)
      const inicioMs = new Date(inicio).getTime()
      if (inicioMs < agoraMs + bufferMs) continue
      slots.push({ inicio, fim: isoSlot(ano, mes, dia, hora + 1) })
    }
  }
  return slots
}

/**
 * Valida que um `inicio` (ISO, qualquer offset) cai exatamente na grade:
 * seg-sex, hora cheia entre 9h e 16h (América/São_Paulo). Usado pelo POST
 * pra rejeitar um slot fora da grade antes de qualquer escrita.
 */
export function slotNaGrade(inicioISO: string): boolean {
  const ms = new Date(inicioISO).getTime()
  if (Number.isNaN(ms)) return false
  // Offset de SP é fixo (-03:00, sem DST) — hora cheia local <=> (ms + 3h)
  // múltiplo de 1h em UTC. Mais simples e robusto que parsear minuto/segundo
  // formatados via Intl.
  if ((ms + 3 * 3600 * 1000) % (3600 * 1000) !== 0) return false
  const { hora, diaSemana } = partesEmSaoPaulo(ms)
  if (diaSemana === 0 || diaSemana === 6) return false
  return (HORAS_SLOT as readonly number[]).includes(hora)
}

/** `inicio` + 1h, como ISO (instante idêntico — serialização UTC é só uma representação). */
export function fimDoSlot(inicioISO: string): string {
  return new Date(new Date(inicioISO).getTime() + 3600_000).toISOString()
}

/** Dois intervalos [inicio,fim) se sobrepõem? */
export function sobrepoe(aInicio: string, aFim: string, bInicio: string, bFim: string): boolean {
  return new Date(aInicio).getTime() < new Date(bFim).getTime()
      && new Date(aFim).getTime()   > new Date(bInicio).getTime()
}

/** "terça-feira, 22/07 às 09h" — para oferecer o horário ao lead / exibir no popup. */
export function formatarSlotPtBr(inicioISO: string): string {
  const d = new Date(inicioISO)
  const diaSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'America/Sao_Paulo' }).format(d)
  const dataCurta = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }).format(d)
  const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' }).format(d)
  return `${diaSemana}, ${dataCurta} às ${hora}h`
}
