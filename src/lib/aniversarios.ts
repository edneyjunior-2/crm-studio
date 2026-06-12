export const ANIVERSARIOS = [
  { mes: 6, dia: 3, nome: 'Edney Junior' },
  { mes: 7, dia: 5, nome: 'Edney Paixão' },
] as const

export type Aniversario = typeof ANIVERSARIOS[number]

export function getAniversarioNoDia(mes: number, dia: number): Aniversario | undefined {
  return ANIVERSARIOS.find((a) => a.mes === mes && a.dia === dia)
}

export function getAniversariosDoMes(ano: number, mes: number): Array<Aniversario & { data: string }> {
  return ANIVERSARIOS
    .filter((a) => a.mes === mes + 1)
    .map((a) => ({
      ...a,
      data: `${ano}-${String(mes + 1).padStart(2, '0')}-${String(a.dia).padStart(2, '0')}`,
    }))
}
