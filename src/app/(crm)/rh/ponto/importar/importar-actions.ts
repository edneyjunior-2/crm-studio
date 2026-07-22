'use server'

import { revalidatePath } from 'next/cache'
import { getAuthAdmin } from '@/lib/auth'
import { assertModulo } from '@/lib/gating'
import { parseFolhaSecullum, type DiaSecullum } from '@/lib/secullum-ponto-parser'
import type {
  ColaboradorAnalisado,
  ResultadoAnaliseFolha,
  PayloadConfirmarImportacao,
} from '@/types/importador-ponto'

// Abaixo do limite global de Server Actions (serverActions.bodySizeLimit = 4.5mb
// em next.config.ts) — deixa margem pro overhead do multipart/form-data.
const TAMANHO_MAXIMO = 4 * 1024 * 1024 // 4 MB

/**
 * Analisa o PDF da folha de ponto e devolve uma prévia — NÃO grava nada no banco.
 * A gravação só acontece em confirmarImportacaoPonto, depois da conferência do RH.
 */
export async function analisarFolhaPonto(
  formData: FormData,
): Promise<{ error?: string; resultado?: ResultadoAnaliseFolha }> {
  const { supabase } = await getAuthAdmin()

  const erroModulo = await assertModulo('rh')
  if (erroModulo) return { error: erroModulo }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { error: 'Arquivo obrigatório.' }
  if (file.size > TAMANHO_MAXIMO) return { error: 'Arquivo muito grande (máx 10 MB).' }
  if (file.type !== 'application/pdf') return { error: 'Envie um PDF exportado do Secullum.' }

  let parseado
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    parseado = await parseFolhaSecullum(bytes)
  } catch {
    return { error: 'Não foi possível ler este PDF. Confirme que é um "Cartão Ponto" exportado do Secullum.' }
  }

  if (parseado.colaboradores.length === 0) {
    return { error: 'Nenhum colaborador encontrado neste PDF.' }
  }

  const cpfs = parseado.colaboradores.map((c) => c.cpf).filter((c): c is string => !!c)

  const { data: existentesRaw } = await supabase
    .from('colaboradores')
    .select('id, nome, cpf, cargo')
    .in('cpf', cpfs.length > 0 ? cpfs : ['__nenhum__'])

  const existentesPorCpf = new Map(
    ((existentesRaw ?? []) as { id: string; nome: string; cpf: string; cargo: string | null }[]).map((c) => [
      c.cpf,
      c,
    ]),
  )

  const colaboradores: ColaboradorAnalisado[] = parseado.colaboradores.map((c) => {
    const existente = c.cpf ? existentesPorCpf.get(c.cpf) : undefined
    return {
      pagina: c.pagina,
      cpf: c.cpf,
      nomeNaFolha: c.nome,
      admissao: c.admissao,
      funcao: c.funcao,
      dias: c.dias,
      avisos: c.avisos,
      colaboradorId: existente?.id ?? null,
      colaboradorNomeAtual: existente?.nome ?? null,
      cargoAtual: existente?.cargo ?? null,
    }
  })

  return {
    resultado: {
      periodoInicio: parseado.periodoInicio,
      periodoFim: parseado.periodoFim,
      colaboradores,
    },
  }
}

function pontoRow(empresaId: string, userId: string, colaboradorId: string, dia: DiaSecullum) {
  const presente = dia.tipo === 'normal' || dia.tipo === 'folga_banco_horas'
  return {
    empresa_id: empresaId,
    colaborador_id: colaboradorId,
    data: dia.data,
    presente,
    justificativa: dia.tipo === 'atestado' ? 'Atestado médico' : null,
    tipo_dia: dia.tipo,
    entrada_1: dia.entrada_1,
    saida_1: dia.saida_1,
    entrada_2: dia.entrada_2,
    saida_2: dia.saida_2,
    batida_manual: dia.batidaManual,
    origem: 'importado_secullum' as const,
    created_by: userId,
  }
}

/** Grava a importação depois da conferência do RH. */
export async function confirmarImportacaoPonto(
  payload: PayloadConfirmarImportacao,
): Promise<{ error?: string; importados?: number }> {
  const { supabase, user, empresaId } = await getAuthAdmin()
  if (!empresaId) return { error: 'Empresa não encontrada.' }

  const erroModulo = await assertModulo('rh')
  if (erroModulo) return { error: erroModulo }

  const linhas: ReturnType<typeof pontoRow>[] = []

  for (const c of payload.colaboradores) {
    if (c.acao === 'ignorar') continue

    let colaboradorId = c.colaboradorId

    if (c.acao === 'cadastrar_ativo' || c.acao === 'cadastrar_desligado') {
      if (!c.nomeNaFolha) continue // sem nome não dá pra cadastrar — linha ignorada silenciosamente

      // Confere de novo logo antes de gravar (não só na análise) — fecha a
      // corrida de um duplo-clique/duas abas cadastrando o mesmo CPF duas vezes.
      if (c.cpf) {
        const { data: jaExiste } = await supabase
          .from('colaboradores')
          .select('id')
          .eq('cpf', c.cpf)
          .maybeSingle()
        if (jaExiste) {
          const idConfirmado: string = jaExiste.id
          colaboradorId = idConfirmado
          for (const dia of c.dias) linhas.push(pontoRow(empresaId, user.id, idConfirmado, dia))
          continue
        }
      }

      const { data: novo, error: erroInsert } = await supabase
        .from('colaboradores')
        .insert({
          nome: c.nomeNaFolha,
          cpf: c.cpf,
          cargo: c.funcao,
          data_admissao: c.admissao,
          status: c.acao === 'cadastrar_ativo' ? 'ativo' : 'desligado',
          created_by: user.id,
        })
        .select('id')
        .single()
      if (erroInsert) return { error: `Falha ao cadastrar ${c.nomeNaFolha}: ${erroInsert.message}` }
      colaboradorId = novo.id
    } else if (c.acao === 'atualizar' && colaboradorId) {
      // Confirma que o colaborador pertence à empresa autenticada — a RLS já
      // filtra por tenant, então um colaboradorId de outra empresa não retorna
      // linha aqui. Sem essa confirmação, um payload malicioso poderia levar
      // pontos de um colaborador de outro tenant a serem gravados sob o
      // empresa_id do usuário atual.
      const { data: atual } = await supabase
        .from('colaboradores')
        .select('cargo')
        .eq('id', colaboradorId)
        .maybeSingle()
      if (!atual) {
        colaboradorId = null
      } else if (c.funcao && !atual.cargo) {
        // Só preenche cargo se estiver vazio — nunca sobrescreve o que já existe.
        await supabase.from('colaboradores').update({ cargo: c.funcao }).eq('id', colaboradorId)
      }
    }

    if (!colaboradorId) continue

    for (const dia of c.dias) {
      linhas.push(pontoRow(empresaId, user.id, colaboradorId, dia))
    }
  }

  const TAMANHO_LOTE = 100
  for (let i = 0; i < linhas.length; i += TAMANHO_LOTE) {
    const lote = linhas.slice(i, i + TAMANHO_LOTE)
    const { error } = await supabase.from('pontos').upsert(lote, { onConflict: 'colaborador_id,data' })
    if (error) return { error: `Falha ao gravar ponto: ${error.message}` }
  }

  revalidatePath('/rh')
  revalidatePath('/rh/ponto')
  revalidatePath('/rh/ponto/cartao')
  revalidatePath('/rh/ponto/relatorio')
  return { importados: linhas.length }
}
