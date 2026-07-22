import type { DiaSecullum } from '@/lib/secullum-ponto-parser'

export type AcaoColaboradorImportacao = 'atualizar' | 'cadastrar_ativo' | 'cadastrar_desligado' | 'ignorar'

export interface ColaboradorAnalisado {
  pagina: number
  cpf: string | null
  nomeNaFolha: string | null
  admissao: string | null
  funcao: string | null
  dias: DiaSecullum[]
  avisos: string[]
  /** Preenchido quando o CPF já existe em colaboradores desta empresa. */
  colaboradorId: string | null
  colaboradorNomeAtual: string | null
  cargoAtual: string | null
}

export interface ResultadoAnaliseFolha {
  periodoInicio: string | null
  periodoFim: string | null
  colaboradores: ColaboradorAnalisado[]
}

export interface ColaboradorConfirmado {
  pagina: number
  cpf: string | null
  nomeNaFolha: string | null
  admissao: string | null
  funcao: string | null
  colaboradorId: string | null
  acao: AcaoColaboradorImportacao
  dias: DiaSecullum[]
}

export interface PayloadConfirmarImportacao {
  colaboradores: ColaboradorConfirmado[]
}
