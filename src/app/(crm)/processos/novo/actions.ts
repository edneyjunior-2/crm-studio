'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  buscarProcessoDataJud,
  detectarTribunal,
  normalizarNumeroCNJ,
  mensagemErroDataJud,
} from '@/lib/datajud'

export interface BuscarProcessoResult {
  numeroProcesso:   string
  tribunalSlug:     string
  assunto:          string
  area:             string
  vara:             string
  comarca:          string
  valor:            number | null
  movimentos:       { codigo: number; nome: string; dataHora: string; complemento?: string }[]
}

export async function buscarProcesso(
  numero: string,
): Promise<BuscarProcessoResult | { erro: string }> {
  const normalizado = normalizarNumeroCNJ(numero)
  const res = await buscarProcessoDataJud(normalizado)

  if (!res.ok) {
    // Mensagem específica por motivo — não mascarar 401/429/rede como "não encontrado".
    return { erro: mensagemErroDataJud(res.motivo) }
  }

  const dados = res.processo
  return {
    numeroProcesso: dados.numeroProcesso,
    tribunalSlug:   dados.tribunalSlug,
    assunto:        dados.assunto ?? '',
    area:           dados.area ?? '',
    vara:           dados.vara ?? '',
    comarca:        dados.comarca ?? '',
    valor:          dados.valor ?? null,
    movimentos:     dados.movimentos,
  }
}

// ---------------------------------------------------------------------------
// Criar cliente "inline" direto do cadastro de processo (sem ir à aba Clientes).
// Retorna { id, razao_social } para o form selecionar o novo cliente na hora.
// ---------------------------------------------------------------------------
export interface CriarClienteInlineResult {
  cliente?: { id: string; razao_social: string }
  error?:   string
}

export async function criarClienteInline(
  razaoSocial: string,
  cnpj?: string,
  contatoNome?: string,
): Promise<CriarClienteInlineResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const nome = razaoSocial?.trim()
  if (!nome) return { error: 'Razão social é obrigatória.' }

  const { data, error } = await supabase
    .from('clientes')
    .insert({
      razao_social:      nome,
      cnpj:              cnpj?.replace(/\D/g, '') || null,
      contato_nome:      contatoNome?.trim() || null,
      area_tipo:         'publica',
      responsavel_id:    user.id,
      responsavel_desde: new Date().toISOString(),
      created_by:        user.id,
    })
    .select('id, razao_social')
    .single()

  if (error) {
    if (error.code === '23505') return { error: 'Já existe um cliente com esse CNPJ.' }
    return { error: error.message }
  }

  revalidatePath('/clientes')
  return { cliente: { id: data.id, razao_social: data.razao_social } }
}

export interface CriarProcessoState {
  error?: string
}

export async function criarProcesso(
  _prev: CriarProcessoState | null,
  formData: FormData,
): Promise<CriarProcessoState | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  // Precisamos do empresa_id para as movimentações (o trigger preenche em
  // processos_juridicos, mas precisamos explicitamente em movimentacoes_processo)
  const { data: profile } = await supabase
    .from('profiles')
    .select('empresa_id')
    .eq('id', user.id)
    .single()

  if (!profile?.empresa_id) return { error: 'Empresa não encontrada.' }
  const empresaId = profile.empresa_id

  const numero     = (formData.get('numero_processo') as string)?.trim()
  const clienteId  = (formData.get('cliente_id') as string)?.trim() || null
  const advogadoId = (formData.get('advogado_id') as string)?.trim() || null
  const area       = (formData.get('area') as string)?.trim() || null
  const assunto    = (formData.get('assunto') as string)?.trim() || null
  const vara       = (formData.get('vara') as string)?.trim() || null
  const comarca    = (formData.get('comarca') as string)?.trim() || null
  const valorRaw   = (formData.get('valor_causa') as string)?.trim()
  const valor      = valorRaw ? parseFloat(valorRaw.replace(',', '.')) : null

  const honTipoRaw   = (formData.get('honorarios_tipo') as string)?.trim()
  const honTipo      = honTipoRaw === 'fixo' || honTipoRaw === 'percentual' ? honTipoRaw : null
  const honValorRaw  = (formData.get('honorarios_valor') as string)?.trim()
  const honValorNum  = honValorRaw ? parseFloat(honValorRaw.replace(',', '.')) : null
  const honValor     = honTipo && honValorNum != null && !Number.isNaN(honValorNum) ? honValorNum : null

  if (!numero) return { error: 'Número do processo é obrigatório.' }

  const normalizado  = normalizarNumeroCNJ(numero)
  const tribunalSlug = detectarTribunal(normalizado)

  // Inserir processo (empresa_id preenchido pelo trigger set_empresa_id)
  const { data: processo, error: errProcesso } = await supabase
    .from('processos_juridicos')
    .insert({
      numero_processo: normalizado,
      tribunal_slug:   tribunalSlug,
      cliente_id:      clienteId,
      advogado_id:     advogadoId,
      area,
      assunto,
      vara,
      comarca,
      valor_causa:      valor && !Number.isNaN(valor) ? valor : null,
      honorarios_tipo:  honTipo,
      honorarios_valor: honValor,
    })
    .select('id')
    .single()

  if (errProcesso) {
    if (errProcesso.code === '23505') {
      return { error: 'Este processo já está cadastrado.' }
    }
    return { error: errProcesso.message }
  }

  // Buscar e salvar movimentações iniciais do DataJud (best-effort — não impede o cadastro)
  try {
    const res = await buscarProcessoDataJud(normalizado, tribunalSlug)
    if (res.ok && res.processo.movimentos.length) {
      // datajud.ts já descarta movimentos com dataHora inválida; aqui só formatamos.
      const movs = res.processo.movimentos.map((m) => {
        const d = new Date(m.dataHora)
        const dataMovimentacao =
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        return {
          processo_id:       processo.id,
          empresa_id:        empresaId,
          codigo_movimento:  m.codigo,
          descricao:         m.nome,
          complemento:       m.complemento || null,
          data_movimentacao: dataMovimentacao,
          lido:              true, // movimentações iniciais não geram badge
          raw_data:          m,
        }
      })

      const { error: errMovs } = await supabase
        .from('movimentacoes_processo')
        .upsert(movs, { onConflict: 'processo_id,codigo_movimento,data_movimentacao', ignoreDuplicates: true })

      if (errMovs) {
        console.error('[processos] falha ao inserir movimentações iniciais:', errMovs.message)
      } else {
        await supabase
          .from('processos_juridicos')
          .update({ ultimo_datajud_update: new Date().toISOString() })
          .eq('id', processo.id)
      }
    } else if (!res.ok && res.motivo !== 'nao_encontrado') {
      console.error(`[processos] DataJud indisponível ao importar movimentações (${res.motivo}) para ${normalizado}`)
    }
  } catch (err) {
    console.error('[processos] erro inesperado ao importar movimentações iniciais:', err)
  }

  revalidatePath('/processos')
  redirect(`/processos/${processo.id}`)
}
