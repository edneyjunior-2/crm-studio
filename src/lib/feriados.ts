export type Feriado = {
  data: string   // YYYY-MM-DD
  nome: string
  tipo: 'nacional' | 'estadual' | 'municipal'
}

// Páscoa — algoritmo de Meeus/Jones/Butcher
function pascoa(ano: number): Date {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31) - 1
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(ano, mes, dia)
}

function fmt(d: Date): string {
  const y = d.getFullYear()
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDias(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function getFeriados(ano: number): Feriado[] {
  const p = pascoa(ano)

  return [
    // Nacionais fixos
    { data: `${ano}-01-01`, nome: 'Ano Novo',                     tipo: 'nacional' as const },
    { data: `${ano}-04-21`, nome: 'Tiradentes',                   tipo: 'nacional' as const },
    { data: `${ano}-05-01`, nome: 'Dia do Trabalho',              tipo: 'nacional' as const },
    { data: `${ano}-09-07`, nome: 'Independência do Brasil',      tipo: 'nacional' as const },
    { data: `${ano}-10-12`, nome: 'Nossa Senhora Aparecida',      tipo: 'nacional' as const },
    { data: `${ano}-11-02`, nome: 'Finados',                      tipo: 'nacional' as const },
    { data: `${ano}-11-15`, nome: 'Proclamação da República',     tipo: 'nacional' as const },
    { data: `${ano}-11-20`, nome: 'Consciência Negra',            tipo: 'nacional' as const },
    { data: `${ano}-12-25`, nome: 'Natal',                        tipo: 'nacional' as const },

    // Nacionais móveis (baseados na Páscoa)
    { data: fmt(addDias(p, -48)), nome: 'Carnaval (segunda)',     tipo: 'nacional' as const },
    { data: fmt(addDias(p, -47)), nome: 'Carnaval (terça)',       tipo: 'nacional' as const },
    { data: fmt(addDias(p,  -2)), nome: 'Sexta-feira Santa',      tipo: 'nacional' as const },
    { data: fmt(addDias(p,  60)), nome: 'Corpus Christi',         tipo: 'nacional' as const },

    // Estadual — Bahia
    { data: `${ano}-07-02`, nome: 'Independência da Bahia',       tipo: 'estadual' as const },

    // Municipal — Salvador
    { data: `${ano}-12-08`, nome: 'Conceição da Praia',          tipo: 'municipal' as const },
  ].sort((a, b) => a.data.localeCompare(b.data))
}

export function getFeriadoNoDia(feriados: Feriado[], data: string): Feriado | undefined {
  return feriados.find((f) => f.data === data)
}
