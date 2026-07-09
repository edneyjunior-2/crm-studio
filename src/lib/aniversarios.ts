// Lista vazia: era hardcoded com aniversários da equipe interna da Aurum
// (resto de quando este CRM era uso interno, não SaaS) — vazava pra
// qualquer tenant que não tem nada a ver com essas pessoas. Sem fonte de
// dados de aniversário por tenant ainda; feature volta quando/se isso
// existir (ex: campo de data de nascimento em profiles).
export const ANIVERSARIOS: readonly { mes: number; dia: number; nome: string }[] = []

export type Aniversario = typeof ANIVERSARIOS[number]

export function getAniversariosDoMes(ano: number, mes: number): Array<Aniversario & { data: string }> {
  return ANIVERSARIOS
    .filter((a) => a.mes === mes + 1)
    .map((a) => ({
      ...a,
      data: `${ano}-${String(mes + 1).padStart(2, '0')}-${String(a.dia).padStart(2, '0')}`,
    }))
}
