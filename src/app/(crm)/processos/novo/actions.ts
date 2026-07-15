'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getAuthUser } from '@/lib/auth'
import { assertModulo } from '@/lib/gating'
import {
  buscarProcessoDataJud,
  detectarTribunal,
  normalizarNumeroCNJ,
  mensagemErroDataJud,
} from '@/lib/datajud'
import { parseValorBR } from '@/lib/honorarios'
import { getProcessosConfig } from '@/lib/processos-config'

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

export interface CriarProcessoState {
  error?: string
}

export async function criarProcesso(
  _prev: CriarProcessoState | null,
  formData: FormData,
): Promise<CriarProcessoState | null> {
  const { supabase, empresaId } = await getAuthUser()

  const erroModulo = await assertModulo('processos')
  if (erroModulo) return { error: erroModulo }

  // Precisamos do empresa_id efetivo (empresa_ativa_id p/ platform admin) para as
  // movimentações (o trigger preenche em processos_juridicos, mas precisamos
  // explicitamente em movimentacoes_processo)
  if (!empresaId) return { error: 'Empresa não encontrada.' }

  const numero      = (formData.get('numero_processo') as string)?.trim()
  // Vários clientes podem ser selecionados; o 1º vira o principal (cliente_id),
  // os demais são gravados em processos_clientes (ver spec: sem coluna "principal"
  // na tabela nova — cliente_id de processos_juridicos já cumpre esse papel).
  const clienteIds  = [...new Set(formData.getAll('cliente_ids').map((v) => v.toString().trim()).filter(Boolean))]
  const clienteId   = clienteIds[0] ?? null
  let advogadoId = (formData.get('advogado_id') as string)?.trim() || null
  if (!advogadoId) {
    // ponytail: nenhum advogado escolhido no form — cai pro padrão da empresa
    // (getProcessosConfig já devolve null se não houver, sem regressão).
    advogadoId = (await getProcessosConfig(supabase, empresaId)).advogado_padrao_id
  }
  const parceiroId = (formData.get('parceiro_id') as string)?.trim() || null
  // Parceiro indicador (public.parceiros) — distinto de parceiroId acima (profiles/portal).
  const indicadorParceiroId = (formData.get('indicador_parceiro_id') as string)?.trim() || null
  const area       = (formData.get('area') as string)?.trim() || null
  const assunto    = (formData.get('assunto') as string)?.trim() || null
  const vara       = (formData.get('vara') as string)?.trim() || null
  const comarca    = (formData.get('comarca') as string)?.trim() || null
  const valorRaw   = (formData.get('valor_causa') as string)?.trim()
  const valorNum   = valorRaw ? parseValorBR(valorRaw) : null
  const valor      = valorNum != null && !Number.isNaN(valorNum) ? valorNum : null

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
      parceiro_id:     parceiroId,
      indicador_parceiro_id: indicadorParceiroId,
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

  // Clientes adicionais (2º em diante) — o principal já foi gravado acima.
  const clientesAdicionais = clienteIds.slice(1)
  if (clientesAdicionais.length > 0) {
    const { error: errClientes } = await supabase
      .from('processos_clientes')
      .insert(clientesAdicionais.map((cliente_id) => ({ processo_id: processo.id, cliente_id })))
    if (errClientes) return { error: `Processo criado, mas falhou ao vincular clientes adicionais: ${errClientes.message}` }
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
