'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import type { EstagioNegocio } from '@/types'
import { negocioSchema } from '@/lib/schemas'
import { deleteCalendarEvent } from '@/lib/google/calendar'

/** Converte valor BR ("1.234,56") para número. Aceita também "1234.56". */
function parseBRL(raw: string): number | null {
  if (!raw) return null
  // Remove espaços e símbolo R$
  const clean = raw.trim().replace(/R\$\s?/g, '')
  // Formato BR: pontos como milhar, vírgula como decimal
  if (clean.includes(',')) {
    return Number(clean.replace(/\./g, '').replace(',', '.'))
  }
  // Fallback: já é ponto como decimal
  return Number(clean)
}

interface ProdutoInput {
  solucao_id: string | null
  valor: number
  ordem: number
}

function parseProdutos(formData: FormData): ProdutoInput[] {
  const countRaw = formData.get('produtos_count') as string
  const count = parseInt(countRaw ?? '0', 10)
  const produtos: ProdutoInput[] = []
  for (let i = 0; i < count; i++) {
    const solucaoId = (formData.get(`produto_solucao_${i}`) as string) || null
    const valorRaw = (formData.get(`produto_valor_${i}`) as string) ?? ''
    const valor = parseBRL(valorRaw) ?? 0
    produtos.push({ solucao_id: solucaoId || null, valor, ordem: i })
  }
  return produtos
}

export async function createNegocio(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const auth = await getAuthUser()
  if (!auth.user) redirect('/login')
  const user = auth.user

  const rawData = Object.fromEntries(formData)
  // responsavel_id é sempre o usuário autenticado — injetamos antes de validar
  rawData.responsavel_id = user.id
  const parsed = negocioSchema.safeParse(rawData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const produtos = parseProdutos(formData)
  const somaValor = produtos.reduce((acc, p) => acc + p.valor, 0)
  const primeiraSolucaoId = produtos[0]?.solucao_id ?? (formData.get('solucao_id') as string)

  const probRaw = formData.get('probabilidade') as string
  const dataRaw = formData.get('data_previsao_fechamento') as string
  const dataFechamento = dataRaw || null

  const parceiroIdRaw = (formData.get('parceiro_id') as string) || null
  const indicadoPorRaw = (formData.get('indicado_por') as string) || null

  const { data: negocioData, error } = await supabase
    .from('negocios')
    .insert({
      titulo: formData.get('titulo') as string,
      cliente_id: formData.get('cliente_id') as string,
      solucao_id: primeiraSolucaoId,
      responsavel_id: user.id,
      estagio: formData.get('estagio') as EstagioNegocio,
      valor_estimado: somaValor > 0 ? somaValor : null,
      probabilidade: probRaw ? Number(probRaw) : null,
      data_previsao_fechamento: dataFechamento,
      data_previsao_original: dataFechamento,
      observacoes: (formData.get('observacoes') as string) || null,
      parceiro_id: parceiroIdRaw,
      indicado_por: indicadoPorRaw,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  // Salva produtos se houver
  if (negocioData?.id && produtos.length > 0 && auth.empresaId) {
    const rows = produtos.map((p) => ({
      negocio_id: negocioData.id,
      empresa_id: auth.empresaId!,
      solucao_id: p.solucao_id,
      valor: p.valor,
      ordem: p.ordem,
    }))
    const { error: prodErr } = await supabase.from('negocio_produtos').insert(rows)
    if (prodErr) return { error: prodErr.message }
  }

  revalidatePath('/pipeline')
  return {}
}

export async function updateNegocio(
  id: string,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const auth = await getAuthUser()
  if (!auth.user) redirect('/login')
  const user = auth.user

  const rawData = Object.fromEntries(formData)
  // responsavel_id pode não estar no formData no update — injetamos para satisfazer o schema
  if (!rawData.responsavel_id) rawData.responsavel_id = user.id
  const parsed = negocioSchema.safeParse(rawData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const produtos = parseProdutos(formData)
  const somaValor = produtos.reduce((acc, p) => acc + p.valor, 0)
  const primeiraSolucaoId = produtos[0]?.solucao_id ?? (formData.get('solucao_id') as string)

  const probRaw = formData.get('probabilidade') as string
  const dataRaw = formData.get('data_previsao_fechamento') as string

  const parceiroIdRaw = (formData.get('parceiro_id') as string) || null
  const indicadoPorRaw = (formData.get('indicado_por') as string) || null

  // Atualiza campos do negócio (exceto valor_estimado e solucao_id, que dependem dos produtos)
  const { error } = await supabase
    .from('negocios')
    .update({
      titulo: formData.get('titulo') as string,
      cliente_id: formData.get('cliente_id') as string,
      estagio: formData.get('estagio') as EstagioNegocio,
      probabilidade: probRaw ? Number(probRaw) : null,
      data_previsao_fechamento: dataRaw || null,
      observacoes: (formData.get('observacoes') as string) || null,
      parceiro_id: parceiroIdRaw,
      indicado_por: indicadoPorRaw,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  // Substitui produtos: insert-primeiro, delete-depois — nunca deixa janela com zero produtos.
  // valor_estimado e solucao_id só são atualizados após o insert bem-sucedido.
  if (auth.empresaId && produtos.length > 0) {
    // 1) Captura IDs dos produtos actuais antes de qualquer alteração
    const { data: produtosAtuais, error: selErr } = await supabase
      .from('negocio_produtos')
      .select('id')
      .eq('negocio_id', id)
    if (selErr) return { error: selErr.message }
    const idsAntigos = (produtosAtuais ?? []).map((r) => r.id as string)

    // 2) Insere os novos produtos
    const rows = produtos.map((p) => ({
      negocio_id: id,
      empresa_id: auth.empresaId!,
      solucao_id: p.solucao_id,
      valor: p.valor,
      ordem: p.ordem,
    }))
    const { data: novosInseridos, error: insErr } = await supabase
      .from('negocio_produtos')
      .insert(rows)
      .select('id')
    if (insErr) {
      // Insert falhou: antigos ainda intactos; desfaz o que porventura inseriu.
      // valor_estimado/solucao_id NÃO foram tocados — negócio permanece consistente.
      const inseridos = novosInseridos as { id: string }[] | null
      if (inseridos && inseridos.length > 0) {
        const idsNovos = inseridos.map((r) => r.id)
        await supabase.from('negocio_produtos').delete().in('id', idsNovos)
      }
      return { error: insErr.message }
    }

    // 3) Insert bem-sucedido: remove os antigos (se havia algum)
    if (idsAntigos.length > 0) {
      const { error: delErr } = await supabase
        .from('negocio_produtos')
        .delete()
        .in('id', idsAntigos)
      if (delErr) return { error: delErr.message }
    }

    // 4) Agora que os produtos estão salvos, actualiza valor_estimado e solucao_id
    const { error: updProdErr } = await supabase
      .from('negocios')
      .update({
        solucao_id: primeiraSolucaoId,
        valor_estimado: somaValor > 0 ? somaValor : null,
      })
      .eq('id', id)
    if (updProdErr) return { error: updProdErr.message }
  }

  revalidatePath('/pipeline')
  return {}
}

export async function updateEstagioComData(
  id: string,
  estagio: string,
  novaData: string | null,
  periodicidade?: string | null,
  dataFechamento?: string | null,
  motivoPerda?: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const auth = await getAuthUser()
  if (!auth.user) redirect('/login')

  // Consulta o tipo da etapa de destino para decidir comportamento (sem hardcode de slugs)
  let tipoEstagio: 'aberto' | 'ganho' | 'perdido' = 'aberto'
  if (auth.empresaId) {
    const { data: estagioRow } = await supabase
      .from('pipeline_estagios')
      .select('tipo')
      .eq('empresa_id', auth.empresaId)
      .eq('slug', estagio)
      .maybeSingle()
    if (estagioRow) tipoEstagio = estagioRow.tipo as 'aberto' | 'ganho' | 'perdido'
  } else {
    // fallback: tenta adivinhar pelo slug legado
    if (estagio === 'fechado_ganho') tipoEstagio = 'ganho'
    else if (estagio === 'fechado_perdido') tipoEstagio = 'perdido'
  }

  const update: Record<string, unknown> = { estagio, updated_at: new Date().toISOString() }
  if (novaData) update.data_previsao_fechamento = novaData

  if (tipoEstagio === 'ganho') {
    update.periodicidade = periodicidade ?? null
    update.data_fechamento = dataFechamento ?? null
    update.motivo_perda = null
  } else if (tipoEstagio === 'perdido') {
    update.motivo_perda = motivoPerda ?? null
    update.data_fechamento = dataFechamento ?? null
  } else {
    // aberto: limpa data de fechamento e motivo de perda
    update.data_fechamento = null
    update.motivo_perda = null
  }

  const { error } = await supabase.from('negocios').update(update).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/pipeline')
  return {}
}

export async function deleteNegocio(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Best-effort: limpar eventos órfãos no Google Calendar antes de excluir.
  // Usa os tokens do responsável de cada registro (não do usuário que exclui).
  try {
    // Busca atividades e followups com google_event_id
    const [{ data: atividades }, { data: followups }] = await Promise.all([
      supabase
        .from('atividades')
        .select('google_event_id, responsavel_id')
        .eq('negocio_id', id)
        .not('google_event_id', 'is', null),
      supabase
        .from('followups')
        .select('google_event_id, responsavel_id')
        .eq('negocio_id', id)
        .not('google_event_id', 'is', null),
    ])

    type EventoParaLimpar = { google_event_id: string; responsavel_id: string }

    const registros: EventoParaLimpar[] = [
      ...(atividades ?? []).filter(
        (a): a is EventoParaLimpar => !!a.google_event_id && !!a.responsavel_id
      ),
      ...(followups ?? []).filter(
        (f): f is EventoParaLimpar => !!f.google_event_id && !!f.responsavel_id
      ),
    ]

    if (registros.length > 0) {
      // Agrupa por responsavel_id para buscar tokens uma vez por usuário
      const porResponsavel = new Map<string, string[]>()
      for (const r of registros) {
        const lista = porResponsavel.get(r.responsavel_id) ?? []
        lista.push(r.google_event_id)
        porResponsavel.set(r.responsavel_id, lista)
      }

      for (const [responsavelId, eventIds] of porResponsavel) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('google_access_token, google_refresh_token, google_token_expiry')
            .eq('id', responsavelId)
            .single()

          if (!profile?.google_refresh_token) continue

          for (const eventId of eventIds) {
            try {
              await deleteCalendarEvent({
                userId: responsavelId,
                accessToken: profile.google_access_token ?? '',
                refreshToken: profile.google_refresh_token,
                tokenExpiry: profile.google_token_expiry ?? new Date(0).toISOString(),
                eventId,
              })
            } catch {
              // Ignora falha individual (evento já pode ter sido excluído manualmente)
            }
          }
        } catch {
          // Falha ao buscar tokens de um responsável não bloqueia os demais
        }
      }
    }
  } catch {
    // Falha no cleanup do Google não bloqueia a exclusão do negócio
  }

  const { error } = await supabase.from('negocios').delete().eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/pipeline')
  return {}
}

export async function reabrirNegocio(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const auth = await getAuthUser()
  if (!auth.user) redirect('/login')

  // Resolve dinamicamente a 1ª etapa ativa do tipo 'aberto' da empresa efetiva
  let slugReaberto: string | null = null
  if (auth.empresaId) {
    const { data: primeiraEtapa } = await supabase
      .from('pipeline_estagios')
      .select('slug')
      .eq('empresa_id', auth.empresaId)
      .eq('tipo', 'aberto')
      .eq('ativo', true)
      .order('ordem', { ascending: true })
      .limit(1)
      .maybeSingle()
    slugReaberto = primeiraEtapa?.slug ?? null
  }

  if (!slugReaberto) {
    return { error: 'Não há etapas abertas configuradas no funil. Adicione ao menos uma etapa do tipo "aberto" nas configurações de pipeline.' }
  }

  const { error } = await supabase
    .from('negocios')
    .update({
      estagio: slugReaberto,
      data_fechamento: null,
      motivo_perda: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/pipeline')
  revalidatePath('/pipeline/historico-perdidos')
  return {}
}
