'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { clienteImportadoSchema } from '@/lib/schemas'
import { fetchAllRows } from '@/lib/supabase/fetch-all'

export interface LinhaImportacao {
  razao_social: string
  cnpj?: string | null
  contato_nome?: string | null
  contato_email?: string | null
  contato_telefone?: string | null
  segmento?: string | null
  observacoes?: string | null
}

export interface ResultadoImportacao {
  importados: number
  pulados: { linha: number; motivo: string }[]
  erro?: string
}

// Retorno especial para CNPJ disponível para assumir
export type VerificarCnpjResult =
  | { status: 'disponivel' }
  | { status: 'bloqueado'; responsavel: string; expiracao: string }
  | { status: 'livre_para_assumir'; clienteId: string; responsavelAnterior: string }
  | { status: 'erro'; message: string }

export async function verificarCnpj(cnpj: string): Promise<VerificarCnpjResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: 'erro', message: 'Não autenticado.' }

  // Buscar cliente com esse CNPJ, incluindo nome do responsável via join
  const { data: cliente, error } = await supabase
    .from('clientes')
    .select('id, razao_social, area_tipo, bloqueio_exclusividade, responsavel_id, responsavel_desde, profiles!responsavel_id(full_name)')
    .eq('cnpj', cnpj)
    .maybeSingle()

  if (error) return { status: 'erro', message: error.message }

  // CNPJ não existe — pode criar
  if (!cliente) return { status: 'disponivel' }

  // Cliente sem bloqueio de exclusividade — qualquer responsável pode assumir
  if (cliente.bloqueio_exclusividade === false) return { status: 'disponivel' }

  const areaTipo = (cliente.area_tipo as 'publica' | 'privada') ?? 'publica'
  const diasBloqueio = areaTipo === 'privada' ? 30 : 90

  const responsavelDesde = cliente.responsavel_desde
    ? new Date(cliente.responsavel_desde)
    : new Date()

  const expiracao = new Date(responsavelDesde.getTime() + diasBloqueio * 24 * 60 * 60 * 1000)
  const agora = new Date()

  const profileRaw = cliente.profiles
  const profileData = Array.isArray(profileRaw) ? profileRaw[0] ?? null : profileRaw
  const responsavelNome = (profileData as { full_name: string } | null)?.full_name ?? 'Desconhecido'

  if (agora < expiracao) {
    // Ainda dentro do bloqueio
    const dd = String(expiracao.getDate()).padStart(2, '0')
    const mm = String(expiracao.getMonth() + 1).padStart(2, '0')
    const yyyy = expiracao.getFullYear()
    return {
      status: 'bloqueado',
      responsavel: responsavelNome,
      expiracao: `${dd}/${mm}/${yyyy}`,
    }
  }

  // Bloqueio expirado — disponível para assumir
  return {
    status: 'livre_para_assumir',
    clienteId: cliente.id,
    responsavelAnterior: responsavelNome,
  }
}

export async function assumirCliente(clienteId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Buscar dados atuais para validar que o bloqueio realmente expirou
  const { data: cliente, error: fetchError } = await supabase
    .from('clientes')
    .select('area_tipo, responsavel_desde')
    .eq('id', clienteId)
    .single()

  if (fetchError) return { error: fetchError.message }
  if (!cliente) return { error: 'Cliente não encontrado.' }

  const areaTipo = (cliente.area_tipo as 'publica' | 'privada') ?? 'publica'
  const diasBloqueio = areaTipo === 'privada' ? 30 : 90
  const responsavelDesde = cliente.responsavel_desde
    ? new Date(cliente.responsavel_desde)
    : new Date()
  const expiracao = new Date(responsavelDesde.getTime() + diasBloqueio * 24 * 60 * 60 * 1000)
  const agora = new Date()

  if (agora < expiracao) {
    return { error: 'O período de bloqueio deste cliente ainda não expirou.' }
  }

  const { error } = await supabase
    .from('clientes')
    .update({ responsavel_id: user.id, responsavel_desde: new Date().toISOString() })
    .eq('id', clienteId)

  if (error) return { error: error.message }

  revalidatePath('/clientes')
  return {}
}

export async function createCliente(
  formData: FormData
): Promise<{ error?: string; cliente?: { id: string; razao_social: string } }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const origemTipo = (formData.get('origem_tipo') as string) || null
  const parceiroId = (formData.get('parceiro_id') as string) || null
  const indicadoPor = (formData.get('indicado_por') as string) || null
  const areaTipo = (formData.get('area_tipo') as string) || 'publica'
  const cnpjRaw = (formData.get('cnpj') as string) || null
  const tipoPessoa = (formData.get('tipo_pessoa') as string) === 'pf' ? 'pf' : 'pj'
  const cpf = (formData.get('cpf') as string) || null
  const bloqueioExclusividade = (formData.get('bloqueio_exclusividade') as string) !== 'false'
  const razaoSocial = formData.get('razao_social') as string

  const { data, error } = await supabase.from('clientes').insert({
    razao_social: razaoSocial,
    tipo_pessoa: tipoPessoa,
    cnpj: tipoPessoa === 'pj' ? (cnpjRaw || null) : null,
    cpf: tipoPessoa === 'pf' ? (cpf || null) : null,
    contato_nome: (formData.get('contato_nome') as string) || null,
    contato_email: (formData.get('contato_email') as string) || null,
    contato_telefone: (formData.get('contato_telefone') as string) || null,
    segmento: (formData.get('segmento') as string) || null,
    observacoes: (formData.get('observacoes') as string) || null,
    origem_tipo: origemTipo as 'prospeccao_direta' | 'parceiro' | 'indicacao_interna' | null,
    parceiro_id: origemTipo === 'parceiro' ? parceiroId : null,
    indicado_por: origemTipo === 'indicacao_interna' ? indicadoPor : null,
    area_tipo: areaTipo as 'publica' | 'privada',
    bloqueio_exclusividade: bloqueioExclusividade,
    responsavel_id: user.id,
    responsavel_desde: new Date().toISOString(),
    created_by: user.id,
  }).select('id, razao_social').single()

  if (error) return { error: error.message }

  revalidatePath('/clientes')
  return { cliente: { id: data.id, razao_social: data.razao_social } }
}

export async function updateCliente(
  id: string,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const origemTipo = (formData.get('origem_tipo') as string) || null
  const parceiroId = (formData.get('parceiro_id') as string) || null
  const indicadoPor = (formData.get('indicado_por') as string) || null
  const tipoPessoa = (formData.get('tipo_pessoa') as string) === 'pf' ? 'pf' : 'pj'
  const cnpjRaw = (formData.get('cnpj') as string) || null
  const cpf = (formData.get('cpf') as string) || null
  const bloqueioExclusividade = (formData.get('bloqueio_exclusividade') as string) !== 'false'

  const { error } = await supabase
    .from('clientes')
    .update({
      razao_social: formData.get('razao_social') as string,
      tipo_pessoa: tipoPessoa,
      cnpj: tipoPessoa === 'pj' ? (cnpjRaw || null) : null,
      cpf: tipoPessoa === 'pf' ? (cpf || null) : null,
      contato_nome: (formData.get('contato_nome') as string) || null,
      contato_email: (formData.get('contato_email') as string) || null,
      contato_telefone: (formData.get('contato_telefone') as string) || null,
      segmento: (formData.get('segmento') as string) || null,
      observacoes: (formData.get('observacoes') as string) || null,
      origem_tipo: origemTipo as 'prospeccao_direta' | 'parceiro' | 'indicacao_interna' | null,
      parceiro_id: origemTipo === 'parceiro' ? parceiroId : null,
      indicado_por: origemTipo === 'indicacao_interna' ? indicadoPor : null,
      bloqueio_exclusividade: bloqueioExclusividade,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/clientes')
  revalidatePath(`/clientes/${id}`)
  return {}
}

export async function deleteCliente(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase.from('clientes').delete().eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/clientes')
  return {}
}

export async function importarClientes(
  linhas: LinhaImportacao[]
): Promise<ResultadoImportacao> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { importados: 0, pulados: [], erro: 'Não autenticado.' }

  // Buscar CNPJs já existentes na empresa (RLS limita ao usuário/empresa)
  let clientesExistentes: { cnpj: string | null }[] = []
  try {
    clientesExistentes = await fetchAllRows<{ cnpj: string | null }>((from, to) =>
      supabase.from('clientes').select('cnpj').range(from, to)
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { importados: 0, pulados: [], erro: msg }
  }

  const cnpjsExistentes = new Set(
    clientesExistentes
      .map((c) => c.cnpj)
      .filter(Boolean) as string[]
  )

  const pulados: { linha: number; motivo: string }[] = []
  const paraInserir: {
    linhaOriginal: number
    dados: {
      razao_social: string
      cnpj: string | null
      contato_nome: string | null
      contato_email: string | null
      contato_telefone: string | null
      segmento: string | null
      observacoes: string | null
      responsavel_id: string
      responsavel_desde: string
      created_by: string
      area_tipo: 'publica'
    }
  }[] = []

  for (let i = 0; i < linhas.length; i++) {
    const linhaN = i + 1
    const linha = linhas[i]

    // Re-validar no servidor
    const parsed = clienteImportadoSchema.safeParse({
      razao_social: linha.razao_social,
      cnpj: linha.cnpj || null,
      contato_nome: linha.contato_nome || null,
      contato_email: linha.contato_email || null,
      contato_telefone: linha.contato_telefone || null,
      segmento: linha.segmento || null,
      observacoes: linha.observacoes || null,
    })

    if (!parsed.success) {
      const motivo = parsed.error.issues.map((issue) => issue.message).join('; ')
      pulados.push({ linha: linhaN, motivo })
      continue
    }

    const data = parsed.data

    // Verificar CNPJ já existente no banco
    if (data.cnpj && cnpjsExistentes.has(data.cnpj)) {
      pulados.push({ linha: linhaN, motivo: 'CNPJ já cadastrado' })
      continue
    }

    paraInserir.push({
      linhaOriginal: linhaN,
      dados: {
        razao_social: data.razao_social,
        cnpj: data.cnpj ?? null,
        contato_nome: data.contato_nome ?? null,
        contato_email: data.contato_email ?? null,
        contato_telefone: data.contato_telefone ?? null,
        segmento: data.segmento ?? null,
        observacoes: data.observacoes ?? null,
        responsavel_id: user.id,
        responsavel_desde: new Date().toISOString(),
        created_by: user.id,
        area_tipo: 'publica',
      },
    })
  }

  if (paraInserir.length === 0) {
    revalidatePath('/clientes')
    return { importados: 0, pulados }
  }

  // Inserir em lotes de 100 para evitar payloads gigantes
  const CHUNK = 100
  let importados = 0

  for (let i = 0; i < paraInserir.length; i += CHUNK) {
    const chunk = paraInserir.slice(i, i + CHUNK)

    const { error: insertError, data: inserted } = await supabase
      .from('clientes')
      .insert(chunk.map((item) => item.dados))
      .select('id')

    if (insertError) {
      // Reportar todas as linhas do chunk como puladas usando o número de linha real
      for (const item of chunk) {
        pulados.push({
          linha: item.linhaOriginal,
          motivo: `Erro ao inserir: ${insertError.message}`,
        })
      }
    } else {
      importados += (inserted ?? chunk).length
    }
  }

  revalidatePath('/clientes')
  return { importados, pulados }
}
