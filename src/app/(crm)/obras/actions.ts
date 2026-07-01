'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { fetchAllRows } from '@/lib/supabase/fetch-all'

const STATUS_OBRA  = ['orcamento', 'em_andamento', 'pausada', 'concluida', 'cancelada'] as const
const STATUS_ETAPA = ['pendente', 'em_andamento', 'concluida'] as const
const STATUS_MEDICAO = ['pendente', 'aprovada', 'faturada'] as const

export async function atualizarStatusObra(
  id: string,
  status: string,
): Promise<{ error?: string }> {
  if (!(STATUS_OBRA as readonly string[]).includes(status)) {
    return { error: 'Status inválido.' }
  }

  const { supabase, empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não encontrada.' }

  const { error } = await supabase
    .from('obras')
    .update({ status })
    .eq('id', id)
    .eq('empresa_id', empresaId)

  if (error) return { error: error.message }

  revalidatePath(`/obras/${id}`)
  revalidatePath('/obras')
  return {}
}

export async function atualizarObra(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string } | null> {
  const { supabase, empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não encontrada.' }

  const obraId = (formData.get('obra_id') as string)?.trim()
  if (!obraId) return { error: 'ID da obra não informado.' }

  const nome = (formData.get('nome') as string)?.trim()
  if (!nome) return { error: 'Nome da obra é obrigatório.' }

  const tipo            = (formData.get('tipo') as string)?.trim() || null
  const clienteId       = (formData.get('cliente_id') as string)?.trim() || null
  const responsavelId   = (formData.get('responsavel_id') as string)?.trim() || null
  const endereco        = (formData.get('endereco') as string)?.trim() || null
  const cidade          = (formData.get('cidade') as string)?.trim() || null
  const estado          = (formData.get('estado') as string)?.trim() || null
  const artNumero       = (formData.get('art_numero') as string)?.trim() || null
  const descricao       = (formData.get('descricao') as string)?.trim() || null
  const statusRaw       = (formData.get('status') as string)?.trim()
  const status          = (STATUS_OBRA as readonly string[]).includes(statusRaw) ? statusRaw : 'orcamento'
  const dataInicio      = (formData.get('data_inicio') as string)?.trim() || null
  const dataPrevisao    = (formData.get('data_previsao_termino') as string)?.trim() || null
  const valorRaw        = (formData.get('valor_contrato') as string)?.replace(/\./g, '').replace(',', '.').trim()
  const valorNum        = valorRaw ? parseFloat(valorRaw) : null
  const valorContrato   = valorNum != null && !Number.isNaN(valorNum) ? valorNum : null

  const { error } = await supabase
    .from('obras')
    .update({
      nome,
      tipo,
      cliente_id:            clienteId || null,
      responsavel_id:        responsavelId || null,
      endereco,
      cidade,
      estado,
      art_numero:            artNumero,
      descricao,
      status,
      data_inicio:           dataInicio || null,
      data_previsao_termino: dataPrevisao || null,
      valor_contrato:        valorContrato,
    })
    .eq('id', obraId)
    .eq('empresa_id', empresaId)

  if (error) return { error: error.message }

  revalidatePath(`/obras/${obraId}`)
  revalidatePath('/obras')
  redirect(`/obras/${obraId}`)
}

export async function deletarObra(id: string): Promise<{ error?: string }> {
  const { supabase, empresaId, role } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não encontrada.' }
  if (role !== 'admin') return { error: 'Apenas administradores podem excluir obras.' }

  const { error } = await supabase
    .from('obras')
    .delete()
    .eq('id', id)
    .eq('empresa_id', empresaId)

  if (error) return { error: error.message }

  revalidatePath('/obras')
  redirect('/obras')
}

export async function criarEtapa(
  obraId: string,
  dados: {
    nome: string
    descricao?: string | null
    percentual_obra?: number | null
    valor?: number | null
    data_previsao?: string | null
    ordem: number
  },
): Promise<{ error?: string }> {
  const { supabase, empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não encontrada.' }

  // Verifica que a obra pertence à empresa antes de inserir
  const { data: obra } = await supabase
    .from('obras')
    .select('id')
    .eq('id', obraId)
    .eq('empresa_id', empresaId)
    .single()
  if (!obra) return { error: 'Obra não encontrada.' }

  const { error } = await supabase
    .from('obras_etapas')
    .insert({
      obra_id:         obraId,
      nome:            dados.nome,
      descricao:       dados.descricao ?? null,
      percentual_obra: dados.percentual_obra ?? null,
      valor:           dados.valor ?? null,
      data_previsao:   dados.data_previsao ?? null,
      ordem:           dados.ordem,
      status:          'pendente',
    })

  if (error) return { error: error.message }

  revalidatePath(`/obras/${obraId}`)
  return {}
}

export async function atualizarStatusEtapa(
  etapaId: string,
  obraId: string,
  status: string,
): Promise<{ error?: string }> {
  if (!(STATUS_ETAPA as readonly string[]).includes(status)) {
    return { error: 'Status inválido.' }
  }

  const { supabase, empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não encontrada.' }

  const { error } = await supabase
    .from('obras_etapas')
    .update({ status })
    .eq('id', etapaId)
    .eq('obra_id', obraId)
    .eq('empresa_id', empresaId)

  if (error) return { error: error.message }

  revalidatePath(`/obras/${obraId}`)
  return {}
}

export async function excluirEtapa(
  etapaId: string,
  obraId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') return { error: 'Apenas administradores podem excluir etapas.' }

  const { error } = await supabase
    .from('obras_etapas')
    .delete()
    .eq('id', etapaId)
    .eq('obra_id', obraId)

  if (error) return { error: error.message }

  revalidatePath(`/obras/${obraId}`)
  return {}
}

export async function criarMedicao(
  obraId: string,
  dados: {
    descricao: string
    percentual?: number | null
    valor?: number | null
    data_medicao?: string | null
  },
): Promise<{ error?: string }> {
  const { supabase, empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não encontrada.' }

  // Verifica ownership e calcula próximo número de medição
  const [{ data: obra }, { data: ultimaMedicao }] = await Promise.all([
    supabase
      .from('obras')
      .select('id')
      .eq('id', obraId)
      .eq('empresa_id', empresaId)
      .single(),
    supabase
      .from('obras_medicoes')
      .select('numero_medicao')
      .eq('obra_id', obraId)
      .order('numero_medicao', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (!obra) return { error: 'Obra não encontrada.' }

  const numeroMedicao = (ultimaMedicao?.numero_medicao ?? 0) + 1

  const { error } = await supabase
    .from('obras_medicoes')
    .insert({
      obra_id:         obraId,
      numero_medicao:  numeroMedicao,
      descricao:       dados.descricao,
      percentual:      dados.percentual ?? null,
      valor:           dados.valor ?? null,
      data_medicao:    dados.data_medicao ?? null,
      status:          'pendente',
    })

  if (error) return { error: error.message }

  revalidatePath(`/obras/${obraId}`)
  return {}
}

export async function atualizarStatusMedicao(
  medicaoId: string,
  obraId: string,
  status: string,
): Promise<{ error?: string }> {
  if (!(STATUS_MEDICAO as readonly string[]).includes(status)) {
    return { error: 'Status inválido.' }
  }

  const { supabase, empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não encontrada.' }

  const { error } = await supabase
    .from('obras_medicoes')
    .update({ status })
    .eq('id', medicaoId)
    .eq('obra_id', obraId)
    .eq('empresa_id', empresaId)

  if (error) return { error: error.message }

  revalidatePath(`/obras/${obraId}`)
  return {}
}

export async function excluirMedicao(
  medicaoId: string,
  obraId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') return { error: 'Apenas administradores podem excluir medições.' }

  const { error } = await supabase
    .from('obras_medicoes')
    .delete()
    .eq('id', medicaoId)
    .eq('obra_id', obraId)

  if (error) return { error: error.message }

  revalidatePath(`/obras/${obraId}`)
  return {}
}

// ---------------------------------------------------------------------------
// Boletim físico-financeiro
// ---------------------------------------------------------------------------

export interface EtapaOrcamento {
  etapa: string
  valorOrcado: number
}

/** Agrupa orcamento_itens por etapa e aplica BDI do orçamento pai. */
export async function listarEtapasOrcamento(
  orcamentoId: string,
): Promise<{ data?: EtapaOrcamento[]; error?: string }> {
  const { supabase, empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não encontrada.' }

  // Busca BDI do orçamento
  const { data: orc, error: orcErr } = await supabase
    .from('orcamentos')
    .select('id, bdi_percentual, empresa_id')
    .eq('id', orcamentoId)
    .eq('empresa_id', empresaId)
    .single()

  if (orcErr || !orc) return { error: 'Orçamento não encontrado.' }

  const bdi = (orc.bdi_percentual as number | null) ?? 0

  // Busca TODOS os itens agrupando por etapa (fetchAllRows contorna o cap de 1000)
  let itens: { etapa: string | null; subtotal: number | null }[]
  try {
    itens = await fetchAllRows<{ etapa: string | null; subtotal: number | null }>((from, to) =>
      supabase
        .from('orcamento_itens')
        .select('etapa, subtotal')
        .eq('orcamento_id', orcamentoId)
        .range(from, to),
    )
  } catch (e) {
    return { error: (e as Error).message }
  }

  // Agrupa por etapa e soma subtotais (aplicando BDI)
  const mapaEtapas = new Map<string, number>()
  for (const item of itens) {
    const etapa = (item.etapa as string | null) ?? 'Sem etapa'
    const sub   = (item.subtotal as number | null) ?? 0
    mapaEtapas.set(etapa, (mapaEtapas.get(etapa) ?? 0) + sub)
  }

  const resultado: EtapaOrcamento[] = Array.from(mapaEtapas.entries()).map(
    ([etapa, subtotal]) => ({
      etapa,
      valorOrcado: subtotal * (1 + bdi / 100),
    }),
  )

  return { data: resultado }
}

export interface EtapaBoletim {
  etapa: string
  valorOrcado: number
  percentual: number
  valorMedido: number
}

export interface BoletimMedicao {
  etapas: EtapaBoletim[]
  totalOrcado: number
  totalMedido: number
  percentualGlobal: number
}

/** Retorna o boletim completo de uma medição (etapas medidas + valores orçados recompostos). */
export async function getBoletimMedicao(
  medicaoId: string,
): Promise<{ data?: BoletimMedicao; error?: string }> {
  const { supabase, empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não encontrada.' }

  // Busca medição com orcamento_id
  const { data: med, error: medErr } = await supabase
    .from('obras_medicoes')
    .select('id, orcamento_id, obra_id')
    .eq('id', medicaoId)
    .single()

  if (medErr || !med) return { error: 'Medição não encontrada.' }

  const orcamentoId = med.orcamento_id as string | null
  if (!orcamentoId) return { error: 'Medição sem orçamento vinculado.' }

  // Busca etapas medidas
  const { data: etapasMedidas, error: etErr } = await supabase
    .from('medicao_etapas')
    .select('etapa, percentual')
    .eq('medicao_id', medicaoId)
    .eq('empresa_id', empresaId)

  if (etErr) return { error: etErr.message }

  // Recompõe valores orçados via listarEtapasOrcamento
  const { data: etapasOrcamento, error: orcErr } = await listarEtapasOrcamento(orcamentoId)
  if (orcErr || !etapasOrcamento) return { error: orcErr ?? 'Erro ao buscar orçamento.' }

  const mapaOrcado = new Map<string, number>(
    etapasOrcamento.map((e) => [e.etapa, e.valorOrcado]),
  )

  const etapas: EtapaBoletim[] = (etapasMedidas ?? []).map((em) => {
    const etapa      = em.etapa as string
    const percentual = (em.percentual as number | null) ?? 0
    const valorOrcado = mapaOrcado.get(etapa) ?? 0
    const valorMedido = valorOrcado * (percentual / 100)
    return { etapa, valorOrcado, percentual, valorMedido }
  })

  const totalOrcado  = etapas.reduce((s, e) => s + e.valorOrcado, 0)
  const totalMedido  = etapas.reduce((s, e) => s + e.valorMedido, 0)
  const percentualGlobal = totalOrcado > 0 ? (totalMedido / totalOrcado) * 100 : 0

  return {
    data: { etapas, totalOrcado, totalMedido, percentualGlobal },
  }
}

/** Cria uma medição boletim físico-financeiro com etapas vinculadas ao orçamento. */
export async function criarMedicaoBoletim(dados: {
  obraId: string
  orcamentoId: string
  numero_medicao?: number
  data_medicao?: string | null
  descricao: string
  etapas: { etapa: string; percentual: number }[]
}): Promise<{ error?: string }> {
  const { supabase, empresaId } = await getAuthUser()
  if (!empresaId) return { error: 'Empresa não encontrada.' }

  // Verifica ownership da obra
  const { data: obra } = await supabase
    .from('obras')
    .select('id')
    .eq('id', dados.obraId)
    .eq('empresa_id', empresaId)
    .single()
  if (!obra) return { error: 'Obra não encontrada.' }

  // Verifica ownership do orçamento
  const { data: orc } = await supabase
    .from('orcamentos')
    .select('id, bdi_percentual, total')
    .eq('id', dados.orcamentoId)
    .eq('empresa_id', empresaId)
    .single()
  if (!orc) return { error: 'Orçamento não encontrado.' }

  // Calcula próximo número de medição
  const { data: ultima } = await supabase
    .from('obras_medicoes')
    .select('numero_medicao')
    .eq('obra_id', dados.obraId)
    .order('numero_medicao', { ascending: false })
    .limit(1)
    .maybeSingle()

  const numeroMedicao = dados.numero_medicao ?? ((ultima?.numero_medicao ?? 0) + 1)

  // Calcula valor total da medição
  const { data: etapasOrcamento } = await listarEtapasOrcamento(dados.orcamentoId)
  const mapaOrcado = new Map<string, number>(
    (etapasOrcamento ?? []).map((e) => [e.etapa, e.valorOrcado]),
  )

  const totalOrcamento = (orc.total as number | null) ?? 0
  let   valorTotal     = 0
  for (const et of dados.etapas) {
    const valorOrcado = mapaOrcado.get(et.etapa) ?? 0
    valorTotal += valorOrcado * (et.percentual / 100)
  }

  const percentualGlobal = totalOrcamento > 0 ? (valorTotal / totalOrcamento) * 100 : null

  // Insere medição principal
  const { data: medicaoInserida, error: medErr } = await supabase
    .from('obras_medicoes')
    .insert({
      obra_id:        dados.obraId,
      empresa_id:     empresaId,
      orcamento_id:   dados.orcamentoId,
      numero_medicao: numeroMedicao,
      descricao:      dados.descricao,
      percentual:     percentualGlobal,
      valor:          valorTotal,
      data_medicao:   dados.data_medicao ?? null,
      status:         'pendente',
    })
    .select('id')
    .single()

  if (medErr || !medicaoInserida) return { error: medErr?.message ?? 'Erro ao criar medição.' }

  // Insere etapas do boletim
  if (dados.etapas.length > 0) {
    const { error: etErr } = await supabase
      .from('medicao_etapas')
      .insert(
        dados.etapas.map((et) => ({
          medicao_id: medicaoInserida.id,
          empresa_id: empresaId,
          etapa:      et.etapa,
          percentual: et.percentual,
        })),
      )
    if (etErr) return { error: etErr.message }
  }

  revalidatePath(`/obras/${dados.obraId}`)
  return {}
}
