'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { buscarProcessoDataJud, detectarTribunal, normalizarNumeroCNJ } from '@/lib/datajud'

export interface BuscarProcessoResult {
  numeroProcesso:   string
  tribunalSlug:     string
  assunto:          string
  vara:             string
  comarca:          string
  valor:            number | null
  partes:           { polo: string; nome: string }[]
  movimentos:       { codigo: number; nome: string; dataHora: string; complemento?: string }[]
  erro?:            string
}

export async function buscarProcesso(numero: string): Promise<BuscarProcessoResult | { erro: string }> {
  const normalizado = normalizarNumeroCNJ(numero)
  const dados = await buscarProcessoDataJud(normalizado)

  if (!dados) {
    return {
      erro: 'Processo não encontrado no DataJud. Você pode cadastrá-lo manualmente.',
    }
  }

  return {
    numeroProcesso: dados.numeroProcesso,
    tribunalSlug:   dados.tribunalSlug,
    assunto:        dados.assunto ?? '',
    vara:           dados.vara ?? '',
    comarca:        dados.comarca ?? '',
    valor:          dados.valor ?? null,
    partes:         dados.partes,
    movimentos:     dados.movimentos,
  }
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

  // Precisamos do empresa_id para as movimentações (o trigger preenche em processos_juridicos,
  // mas precisamos explicitamente em movimentacoes_processo)
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
  const partesRaw  = (formData.get('partes_raw') as string) || null

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
      valor_causa:     valor,
      partes_raw:      partesRaw ? JSON.parse(partesRaw) : null,
    })
    .select('id')
    .single()

  if (errProcesso) {
    if (errProcesso.code === '23505') {
      return { error: 'Este processo já está cadastrado.' }
    }
    return { error: errProcesso.message }
  }

  // Buscar e salvar movimentações iniciais do DataJud (best-effort)
  try {
    const dados = await buscarProcessoDataJud(normalizado, tribunalSlug)
    if (dados?.movimentos?.length) {
      const movs = dados.movimentos.map((m) => {
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

      await supabase
        .from('movimentacoes_processo')
        .upsert(movs, { onConflict: 'processo_id,codigo_movimento,data_movimentacao', ignoreDuplicates: true })

      await supabase
        .from('processos_juridicos')
        .update({ ultimo_datajud_update: new Date().toISOString() })
        .eq('id', processo.id)
    }
  } catch {
    // Falha na busca inicial não impede o cadastro
  }

  revalidatePath('/processos')
  redirect(`/processos/${processo.id}`)
}
