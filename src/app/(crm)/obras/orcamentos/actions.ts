'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import { fetchAllRows } from '@/lib/supabase/fetch-all'

export type CategoriaItem = 'mao_obra' | 'material' | 'composicao'

export interface CatalogoResultado {
  tipo: 'insumo' | 'composicao'
  codigo: string
  descricao: string
  unidade: string | null
  grupo: string | null
  custo: number | null // já resolvido (com/sem desoneração) conforme o orçamento
}

/** Busca no catálogo SINAPI/ORSE conforme contexto do orçamento. */
export async function buscarCatalogo(
  termo: string,
  ctx: { uf: string; data_ref: string; fonte: string; desoneracao: boolean; tipo?: 'insumo' | 'composicao' },
): Promise<CatalogoResultado[]> {
  const { supabase } = await getAuthUser()
  const t = termo.trim()
  if (t.length < 2) return []

  let q = supabase
    .from('precos_referencia')
    .select('tipo, codigo, descricao, unidade, grupo, custo_com_desoneracao, custo_sem_desoneracao')
    .eq('uf', ctx.uf)
    .eq('fonte', ctx.fonte)
    .limit(40)

  if (ctx.data_ref) q = q.eq('data_ref', ctx.data_ref)
  if (ctx.tipo) q = q.eq('tipo', ctx.tipo)

  // termo numérico → busca por código; senão por descrição (trigram)
  q = /^\d+$/.test(t) ? q.eq('codigo', t) : q.ilike('descricao', `%${t}%`)

  const { data } = await q
  return (data ?? []).map((r) => ({
    tipo: r.tipo,
    codigo: r.codigo,
    descricao: r.descricao,
    unidade: r.unidade,
    grupo: r.grupo,
    custo: ctx.desoneracao ? r.custo_com_desoneracao : r.custo_sem_desoneracao,
  }))
}

async function recalcularTotal(orcamentoId: string) {
  const { supabase } = await getAuthUser()
  const [itens, { data: orc }] = await Promise.all([
    fetchAllRows<{ subtotal: number | null }>((from, to) =>
      supabase
        .from('orcamento_itens')
        .select('subtotal')
        .eq('orcamento_id', orcamentoId)
        .range(from, to)
    ),
    supabase.from('orcamentos').select('bdi_percentual').eq('id', orcamentoId).single(),
  ])
  const custoDireto = itens.reduce((s, i) => s + Number(i.subtotal ?? 0), 0)
  const bdi = Number(orc?.bdi_percentual ?? 0)
  const total = Math.round(custoDireto * (1 + bdi / 100) * 100) / 100
  const { error } = await supabase
    .from('orcamentos')
    .update({ total, updated_at: new Date().toISOString() })
    .eq('id', orcamentoId)
  if (error) {
    console.error('Erro ao recalcular total do orçamento:', error)
    throw new Error(`Falha ao gravar o total do orçamento: ${error.message}`)
  }
}

export async function criarOrcamento(formData: FormData): Promise<{ error?: string }> {
  const { supabase, user } = await getAuthUser()
  const titulo = (formData.get('titulo') as string)?.trim()
  const modelo = (formData.get('modelo') as string) || 'mao_obra_material'
  const uf = ((formData.get('uf') as string) || 'BA').toUpperCase()
  const obraId = (formData.get('obra_id') as string) || null
  const clienteId = (formData.get('cliente_id') as string) || null
  const dataRefMes = (formData.get('data_ref_sinapi') as string) || null // AAAA-MM
  if (!titulo) return { error: 'Informe um título.' }

  const { data, error } = await supabase
    .from('orcamentos')
    .insert({
      titulo,
      modelo,
      uf,
      obra_id: obraId || null,
      cliente_id: clienteId || null,
      data_ref_sinapi: dataRefMes ? `${dataRefMes}-01` : null,
      created_by: user.id,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }
  revalidatePath('/obras/orcamentos')
  redirect(`/obras/orcamentos/${data.id}`)
}

export async function atualizarOrcamento(
  id: string,
  campos: { titulo?: string; modelo?: string; bdi_percentual?: number; desoneracao?: boolean; status?: string; observacoes?: string; data_ref_sinapi?: string | null; cliente_id?: string | null; obra_id?: string | null },
): Promise<{ error?: string }> {
  const { supabase } = await getAuthUser()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const [k, v] of Object.entries(campos)) if (v !== undefined) patch[k] = v
  if (campos.data_ref_sinapi) patch.data_ref_sinapi = `${campos.data_ref_sinapi}-01`
  const { error } = await supabase.from('orcamentos').update(patch).eq('id', id)
  if (error) return { error: error.message }
  if (campos.bdi_percentual !== undefined) await recalcularTotal(id)
  revalidatePath(`/obras/orcamentos/${id}`)
  return {}
}

export async function adicionarItem(
  orcamentoId: string,
  item: { etapa?: string; categoria?: CategoriaItem; codigo_sinapi?: string; descricao: string; unidade?: string | null; quantidade: number; custo_unitario: number },
): Promise<{ error?: string; id?: string }> {
  const { supabase } = await getAuthUser()
  if (!item.descricao?.trim()) return { error: 'Descrição obrigatória.' }
  const quantidade = Number(item.quantidade) || 0
  const custo = Number(item.custo_unitario) || 0
  const subtotal = Math.round(quantidade * custo * 100) / 100
  // .select('id') devolve o id real — o editor troca o id temporário (tmp-) pelo
  // real; senão editar/remover o item recém-adicionado no-opam em silêncio.
  const { data, error } = await supabase.from('orcamento_itens').insert({
    orcamento_id: orcamentoId,
    etapa: item.etapa?.trim() || 'Geral',
    categoria: item.categoria ?? 'composicao',
    codigo_sinapi: item.codigo_sinapi || null,
    descricao: item.descricao.trim(),
    unidade: item.unidade || null,
    quantidade,
    custo_unitario: custo,
    subtotal,
  }).select('id').single()
  if (error) return { error: error.message }
  await recalcularTotal(orcamentoId)
  revalidatePath(`/obras/orcamentos/${orcamentoId}`)
  return { id: data.id as string }
}

export async function atualizarItem(
  itemId: string,
  orcamentoId: string,
  campos: { etapa?: string; quantidade?: number; custo_unitario?: number; descricao?: string },
): Promise<{ error?: string }> {
  const { supabase } = await getAuthUser()
  const { data: atual } = await supabase
    .from('orcamento_itens').select('quantidade, custo_unitario').eq('id', itemId).single()
  const quantidade = campos.quantidade ?? Number(atual?.quantidade ?? 0)
  const custo = campos.custo_unitario ?? Number(atual?.custo_unitario ?? 0)
  const patch: Record<string, unknown> = { ...campos }
  patch.subtotal = Math.round(quantidade * custo * 100) / 100
  const { error } = await supabase.from('orcamento_itens').update(patch).eq('id', itemId)
  if (error) return { error: error.message }
  await recalcularTotal(orcamentoId)
  revalidatePath(`/obras/orcamentos/${orcamentoId}`)
  return {}
}

export async function removerItem(itemId: string, orcamentoId: string): Promise<{ error?: string }> {
  const { supabase } = await getAuthUser()
  const { error } = await supabase.from('orcamento_itens').delete().eq('id', itemId)
  if (error) return { error: error.message }
  await recalcularTotal(orcamentoId)
  revalidatePath(`/obras/orcamentos/${orcamentoId}`)
  return {}
}

export async function excluirOrcamento(id: string): Promise<{ error?: string }> {
  const { supabase } = await getAuthUser()
  const { error } = await supabase.from('orcamentos').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/obras/orcamentos')
  redirect('/obras/orcamentos')
}

export interface OrcamentoPdfData {
  orcamento: {
    titulo: string; modelo: string; uf: string; fonte: string; data_ref_sinapi: string | null
    bdi_percentual: number; desoneracao: boolean; observacoes: string | null
    cliente: { razao_social: string; cnpj: string | null } | null
    obra: { nome: string; endereco: string | null } | null
  }
  itens: {
    etapa: string | null; codigo_sinapi: string | null; descricao: string; unidade: string | null
    quantidade: number; custo_unitario: number; subtotal: number
  }[]
  empresa: { nome: string; razao_social: string | null; nome_fantasia: string | null; cnpj: string | null } | null
}

/** Carrega os dados necessários para a pré-visualização/PDF do orçamento (mesmo shape de /pdf). */
export async function getOrcamentoPdfData(id: string): Promise<{ data?: OrcamentoPdfData; error?: string }> {
  const { supabase, empresaId } = await getAuthUser()

  const [{ data: orcamento, error }, { data: itens }, { data: empresa }] = await Promise.all([
    supabase.from('orcamentos').select('*, cliente:clientes(razao_social, cnpj), obra:obras(nome, endereco)').eq('id', id).single(),
    supabase.from('orcamento_itens').select('*').eq('orcamento_id', id).order('etapa').order('created_at'),
    empresaId
      ? supabase.from('empresas').select('nome, razao_social, nome_fantasia, cnpj').eq('id', empresaId).single()
      : Promise.resolve({ data: null }),
  ])

  if (error || !orcamento) return { error: error?.message ?? 'Orçamento não encontrado.' }

  return {
    data: {
      orcamento: orcamento as OrcamentoPdfData['orcamento'],
      itens: (itens ?? []) as OrcamentoPdfData['itens'],
      empresa: (empresa ?? null) as OrcamentoPdfData['empresa'],
    },
  }
}
