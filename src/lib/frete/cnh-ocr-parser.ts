/**
 * cnh-ocr-parser.ts — OCR de CNH (Google Cloud Vision) + parser de campos
 *
 * Spec: .claude/specs/frete-03-ocr-cnh.md
 *
 * Decisão do dono (research/27-ocr-cnh-upload-foto.md): construir OCR internamente
 * via Google Cloud Vision (TEXT_DETECTION, ~R$0,01/imagem) em vez de contratar
 * Infosimples/idwall (custo fixo mensal inaceitável sem cliente pagante).
 *
 * OCR NÃO garante autenticidade (research/26, research/27) — é atalho de
 * preenchimento; o usuário sempre confirma/edita os campos antes de salvar
 * (aviso feito na UI, ver cnh-upload-section.tsx). Nenhuma validação oficial
 * (QR Code/consulta SENATRAN) é feita aqui — fica pra fase 2.
 *
 * ponytail: parser por regex simples/heurística de layout Renach/Mercosul —
 * sem biblioteca de NLP/ML. Campo não encontrado fica `undefined`; o parser
 * NUNCA inventa/adivinha um valor.
 *
 * demo() roda um texto de exemplo simulando a saída bruta do Google Vision
 * pra uma CNH modelo Renach/Mercosul e confere que os 5 campos são extraídos.
 * Check rodável (não faz parte do build): `npx tsx src/lib/frete/cnh-ocr-parser.ts`.
 */

export interface CnhDadosExtraidos {
  nome?: string
  cpf?: string
  cnhNumero?: string
  cnhCategoria?: string
  cnhValidade?: string // YYYY-MM-DD
  /** Heurística: quantos dos 5 campos acima foram encontrados. 'baixa' com 2 ou menos. */
  confianca: 'alta' | 'media' | 'baixa'
}

// ---------------------------------------------------------------------------
// Chamada à API REST do Google Cloud Vision
// ---------------------------------------------------------------------------

function apiKeyOuFalha(): string {
  const apiKey = process.env.GOOGLE_VISION_API_KEY
  if (!apiKey) {
    throw new Error(
      'GOOGLE_VISION_API_KEY não configurada — defina a variável de ambiente para habilitar a leitura automática de CNH.'
    )
  }
  return apiKey
}

async function extrairTextoDeImagem(base64Conteudo: string, apiKey: string): Promise<string> {
  const resposta = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [
        {
          image: { content: base64Conteudo },
          features: [{ type: 'TEXT_DETECTION' }],
        },
      ],
    }),
  })

  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => '')
    throw new Error(`Google Cloud Vision retornou erro ${resposta.status}: ${corpo.slice(0, 300)}`)
  }

  const json = await resposta.json()
  const respostaVision = json?.responses?.[0]

  if (respostaVision?.error) {
    throw new Error(`Google Cloud Vision: ${respostaVision.error.message ?? 'erro desconhecido'}`)
  }

  // fullTextAnnotation.text preserva quebras de linha (melhor pro parser de
  // layout abaixo); textAnnotations[0].description é o fallback equivalente.
  return respostaVision?.fullTextAnnotation?.text ?? respostaVision?.textAnnotations?.[0]?.description ?? ''
}

/**
 * PDF precisa de um endpoint DIFERENTE do de imagem — images:annotate não
 * rasteriza PDF (achado do review 2026-07-16, que por isso tirou PDF da
 * whitelist). O endpoint certo é files:annotate + DOCUMENT_TEXT_DETECTION,
 * síncrono para documentos pequenos (até 5 páginas) — confirmado funcionando
 * com uma chamada real em 2026-07-17 (CNH exportada em PDF pelo app CNH
 * Digital é exatamente esse caso). Só lê a 1ª página — CNH sempre cabe numa.
 */
async function extrairTextoDePdf(base64Conteudo: string, apiKey: string): Promise<string> {
  const resposta = await fetch(`https://vision.googleapis.com/v1/files:annotate?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [
        {
          inputConfig: { content: base64Conteudo, mimeType: 'application/pdf' },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          pages: [1],
        },
      ],
    }),
  })

  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => '')
    throw new Error(`Google Cloud Vision retornou erro ${resposta.status}: ${corpo.slice(0, 300)}`)
  }

  const json = await resposta.json()
  // files:annotate aninha um nível a mais que images:annotate: um item por
  // requisição, e dentro dele um item por página processada.
  const respostaPagina = json?.responses?.[0]?.responses?.[0]

  if (respostaPagina?.error) {
    throw new Error(`Google Cloud Vision: ${respostaPagina.error.message ?? 'erro desconhecido'}`)
  }

  return respostaPagina?.fullTextAnnotation?.text ?? ''
}

/**
 * Chama a API REST do Google Cloud Vision e devolve o texto bruto extraído do
 * documento — roteia pro endpoint certo conforme o tipo (imagem vs. PDF; ver
 * extrairTextoDePdf). Usa a env var GOOGLE_VISION_API_KEY (chave de API
 * simples, não service account/OAuth).
 *
 * Se a env var não estiver configurada, lança um erro claro e explícito —
 * nunca falha silenciosamente nem retorna string vazia (fail loud, ver
 * "Segurança" na spec).
 */
export async function extrairTextoImagem(base64Conteudo: string, mimeType: string): Promise<string> {
  const apiKey = apiKeyOuFalha()
  return mimeType === 'application/pdf'
    ? extrairTextoDePdf(base64Conteudo, apiKey)
    : extrairTextoDeImagem(base64Conteudo, apiKey)
}

// ---------------------------------------------------------------------------
// Parser de campos (heurística de layout Renach/Mercosul)
// ---------------------------------------------------------------------------

/** Categorias válidas de CNH (mesmo CHECK de frete_motoristas.cnh_categoria). Combinadas antes das simples. */
const CATEGORIAS_VALIDAS = ['AB', 'AC', 'AD', 'AE', 'A', 'B', 'C', 'D', 'E']

/**
 * Procura, linha a linha, por um rótulo (ex.: "NOME", "CPF") e devolve o valor
 * associado: o restante da própria linha após o rótulo (quando o OCR manteve
 * label e valor juntos) ou, se a linha só tem o rótulo, a próxima linha não
 * vazia (layout mais comum de CNH: label numa linha, valor na seguinte).
 */
function pegarValorAposLabel(linhas: string[], labelRegex: RegExp): string | undefined {
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i].trim()
    const match = linha.match(labelRegex)
    if (!match) continue

    const resto = linha.slice(match[0].length).replace(/^[:\-\s]+/, '').trim()
    if (resto) return resto

    for (let j = i + 1; j < linhas.length; j++) {
      const proxima = linhas[j].trim()
      if (proxima) return proxima
    }
  }
  return undefined
}

function formatarCpf(bruto: string): string | undefined {
  const digitos = bruto.replace(/\D/g, '')
  if (digitos.length !== 11) return bruto.trim() || undefined
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9, 11)}`
}

function extrairCategoria(bruto: string): string | undefined {
  const upper = bruto.toUpperCase()
  for (const categoria of CATEGORIAS_VALIDAS) {
    if (new RegExp(`\\b${categoria}\\b`).test(upper)) return categoria
  }
  return undefined
}

/** "15/08/2030" → "2030-08-15". Transformação de string pura, sem Date/timezone. */
function converterDataParaIso(bruto: string): string | undefined {
  const m = bruto.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (!m) return undefined
  const [, dd, mm, yyyy] = m
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Recebe o texto bruto do OCR e tenta mapear pros campos da CNH via
 * regex/heurística de layout (padrão Renach/Mercosul: labels "NOME", "CPF",
 * "Nº REGISTRO"/"REGISTRO", "CAT. HAB."/"CATEGORIA", "VALIDADE"). Campo não
 * encontrado fica undefined — NUNCA inventa/adivinha um valor.
 */
export function parsearCamposCnh(textoOcr: string): CnhDadosExtraidos {
  const linhas = textoOcr.split(/\r?\n/)

  const nomeBruto = pegarValorAposLabel(linhas, /^NOME\b/i)
  const cpfBruto = pegarValorAposLabel(linhas, /^CPF\b/i)
  const cnhNumeroBruto = pegarValorAposLabel(linhas, /^(N[º°o]?\.?\s*)?REGISTRO\b/i)
  const categoriaBruto = pegarValorAposLabel(linhas, /^CAT\.?\s*HAB\b\.?|^CATEGORIA\b/i)
  const validadeBruto = pegarValorAposLabel(linhas, /^VALIDADE\b/i)

  const nome = nomeBruto?.trim() || undefined
  const cpf = cpfBruto ? formatarCpf(cpfBruto) : undefined
  const cnhNumero = cnhNumeroBruto ? (cnhNumeroBruto.match(/\d{6,11}/)?.[0] ?? cnhNumeroBruto.trim()) : undefined
  const cnhCategoria = categoriaBruto ? extrairCategoria(categoriaBruto) : undefined
  const cnhValidade = validadeBruto ? converterDataParaIso(validadeBruto) : undefined

  const camposEncontrados = [nome, cpf, cnhNumero, cnhCategoria, cnhValidade].filter(Boolean).length
  const confianca: CnhDadosExtraidos['confianca'] =
    camposEncontrados >= 5 ? 'alta' : camposEncontrados >= 3 ? 'media' : 'baixa'

  return { nome, cpf, cnhNumero, cnhCategoria, cnhValidade, confianca }
}

// ---------------------------------------------------------------------------
// Check rodável
// ---------------------------------------------------------------------------

/** Texto de exemplo simulando a saída bruta (fullTextAnnotation.text) do Google Vision para uma CNH Renach/Mercosul. */
const TEXTO_OCR_EXEMPLO = `
REPÚBLICA FEDERATIVA DO BRASIL
CARTEIRA NACIONAL DE HABILITAÇÃO
NOME
JOAO DA SILVA SANTOS
DOC.IDENTIDADE / ORG EMISSOR / UF
12.345.678-9 SSP SP
CPF
123.456.789-00
DATA NASCIMENTO
01/01/1990
NACIONALIDADE
BRASILEIRA
Nº REGISTRO
12345678901
VALIDADE
15/08/2030
1ª HABILITAÇÃO
10/05/2010
CAT. HAB.
AB
ACC
NAO
OBSERVAÇÕES
`.trim()

/** `npx tsx src/lib/frete/cnh-ocr-parser.ts` — não faz parte do build. */
export function demo(): void {
  const resultado = parsearCamposCnh(TEXTO_OCR_EXEMPLO)

  console.assert(resultado.nome === 'JOAO DA SILVA SANTOS', `nome incorreto: ${resultado.nome}`)
  console.assert(resultado.cpf === '123.456.789-00', `cpf incorreto: ${resultado.cpf}`)
  console.assert(resultado.cnhNumero === '12345678901', `cnhNumero incorreto: ${resultado.cnhNumero}`)
  console.assert(resultado.cnhCategoria === 'AB', `cnhCategoria incorreta: ${resultado.cnhCategoria}`)
  console.assert(resultado.cnhValidade === '2030-08-15', `cnhValidade incorreta: ${resultado.cnhValidade}`)
  console.assert(resultado.confianca === 'alta', `confianca incorreta: ${resultado.confianca}`)

  console.log('parsearCamposCnh(TEXTO_OCR_EXEMPLO) =', JSON.stringify(resultado, null, 2))
}
