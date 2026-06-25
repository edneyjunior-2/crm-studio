/**
 * modulos.ts — Biblioteca de gating por módulo/plano
 *
 * ⚠️  ATENÇÃO: preços, composição de planos e limites são PROVISÓRIOS.
 * Edite os valores aqui (e no seed da migration correspondente) para ajustar
 * sem necessidade de reconstruir o app.
 *
 * Tipos de plano/status reaproveitados de src/lib/auth.ts (não duplicar).
 */

import type { PlanoEmpresa, StatusEmpresa } from '@/lib/auth'

// Re-exporta para consumidores que precisem só dos tipos de billing
export type { PlanoEmpresa, StatusEmpresa }

// ---------------------------------------------------------------------------
// 1. Catálogo canônico de módulos
// ---------------------------------------------------------------------------

/**
 * Slugs de todos os módulos de gating do CRM Studio.
 * Cada slug casa com um registro em `modulos_catalogo` (banco).
 * Dashboard, configuracoes e minha-conta são INFRA de conta — não recebem flag.
 */
export const MODULOS = [
  'pipeline',   // /pipeline
  'clientes',   // /clientes
  'solucoes',   // /solucoes
  'parceiros',  // /parceiros
  'financeiro', // /financeiro (AP/AR, bancos, fornecedores, relatório, dashboard fin.)
  'comissoes',  // /financeiro/comissoes — depende de 'financeiro'
  'fluxos',     // /fluxos
  'calendario', // /calendario
  'contratos',  // /contratos
  'automacoes', // /automacoes
  'estoque',    // /estoque
  'rh',         // /rh
  'processos',  // /processos — módulo vertical Advocacia (processos jurídicos + DataJud)
  'obras',      // /obras — módulo vertical Engenharia/Construção Civil
] as const

export type Modulo = (typeof MODULOS)[number]

export const MODULO_LABEL: Record<Modulo, string> = {
  pipeline:   'Pipeline de vendas',
  clientes:   'Gestão de clientes',
  solucoes:   'Portfólio de soluções',
  parceiros:  'Parceiros e representantes',
  financeiro: 'Financeiro (AP/AR)',
  comissoes:  'Controle de comissões',
  fluxos:     'Fluxos de trabalho',
  calendario: 'Calendário',
  contratos:  'Contratos',
  automacoes: 'Automações de funil',
  estoque:    'Gestão de estoque',
  rh:         'Recursos Humanos',
  processos:  'Processos Jurídicos',
  obras:      'Obras e Construção Civil',
}

// ---------------------------------------------------------------------------
// 2. Módulos reservados (off globalmente até serem ativados em plano/empresa)
// ---------------------------------------------------------------------------

/**
 * Módulos globalmente bloqueados que nunca são adicionados via plano.
 * Vazio: estoque e rh já estão construídos (M7 concluído) e entram no Business.
 *
 * ⚠️  PROVISÓRIO — ajustar se algum módulo precisar ser desligado globalmente.
 */
export const MODULOS_RESERVADOS: Modulo[] = []

// ---------------------------------------------------------------------------
// 3. Dependências entre módulos
// ---------------------------------------------------------------------------

/**
 * Um módulo só é efetivo se o módulo do qual depende também estiver ativo.
 * Chave → depende de Valor.
 * Ex.: 'comissoes' exige 'financeiro'.
 */
export const DEPENDENCIAS: Partial<Record<Modulo, Modulo>> = {
  comissoes: 'financeiro',
}

// ---------------------------------------------------------------------------
// 4. Mapeamento plano → módulos (fonte da verdade em TS)
// ---------------------------------------------------------------------------

/**
 * Módulos embutidos em cada plano. Deve bater exatamente com o seed da migration.
 *
 * ⚠️  PROVISÓRIO — composição a confirmar com produto/preço.
 *   free     → CRM básico (isca de aquisição)
 *   starter  → free + colaboração, sem financeiro
 *   pro      → tudo de CRM + financeiro + comissoes + automacoes (produto completo)
 *   business → pro + estoque + rh (upsell pós-M7)
 */
export const MODULOS_POR_PLANO: Record<PlanoEmpresa, Modulo[]> = {
  free: [
    'pipeline', 'clientes', 'solucoes', 'calendario',
  ],
  // trial = acesso total por 7 dias (cliente experimenta o produto completo)
  trial: [
    'pipeline', 'clientes', 'solucoes', 'calendario',
    'parceiros', 'fluxos', 'contratos',
    'financeiro', 'comissoes', 'automacoes',
    'estoque', 'rh', 'processos', 'obras',
  ],
  // interno = acesso total (empresas internas da plataforma)
  interno: [
    'pipeline', 'clientes', 'solucoes', 'calendario',
    'parceiros', 'fluxos', 'contratos',
    'financeiro', 'comissoes', 'automacoes',
    'estoque', 'rh', 'processos', 'obras',
  ],
  starter: [
    'pipeline', 'clientes', 'solucoes', 'calendario',
    'parceiros', 'fluxos', 'contratos',
  ],
  pro: [
    'pipeline', 'clientes', 'solucoes', 'calendario',
    'parceiros', 'fluxos', 'contratos',
    'financeiro', 'comissoes', 'automacoes',
    // 'processos' e 'obras' são verticais: entram via modulos_ativos (Área de atuação no admin)
  ],
  business: [
    'pipeline', 'clientes', 'solucoes', 'calendario',
    'parceiros', 'fluxos', 'contratos',
    'financeiro', 'comissoes', 'automacoes',
    'estoque', 'rh',
    // 'processos' e 'obras' são verticais: entram via modulos_ativos (Área de atuação no admin)
  ],
}

// ---------------------------------------------------------------------------
// 5. Módulos liberados por add-on
// ---------------------------------------------------------------------------

/**
 * Mapa add-on slug → módulos que ele libera.
 * Add-ons com em_breve=true no banco não afetam o app ainda;
 * entram aqui para o código já reconhecê-los sem erro.
 *
 * ⚠️  PROVISÓRIO — add-ons em breve; slugs de módulos sujeitos a alteração.
 */
export const ADDON_MODULOS: Record<string, Modulo[]> = {
  gerador_contratos: ['contratos'],
  // sdr_whatsapp libera 'sdr' — módulo ainda não existe no MODULOS; ignorado por modulosEfetivos
}

// ---------------------------------------------------------------------------
// 6. Limites por plano
// ---------------------------------------------------------------------------

/**
 * Limites quantitativos por plano.
 * -1 = ilimitado.
 *
 * ⚠️  PROVISÓRIO — valores a confirmar com produto.
 * A checagem roda nas Server Actions de criação (convidar usuário, criar funil, etc.).
 */
export const LIMITES_POR_PLANO: Record<
  PlanoEmpresa,
  { usuarios: number; funis: number; solucoes: number }
> = {
  free:     { usuarios: 1,  funis: 1,  solucoes: 3  },
  trial:    { usuarios: -1, funis: -1, solucoes: -1 },
  interno:  { usuarios: -1, funis: -1, solucoes: -1 },
  starter:  { usuarios: 3,  funis: 1,  solucoes: 10 },
  pro:      { usuarios: 10, funis: 3,  solucoes: -1 },
  business: { usuarios: -1, funis: -1, solucoes: -1 },
}

// ---------------------------------------------------------------------------
// 7. Helpers
// ---------------------------------------------------------------------------

/**
 * Retorna o conjunto efetivo de módulos para uma empresa.
 *
 * Resolução:
 *   módulos do plano
 *   ∪ extras válidos (add-ons / cortesia em empresas.modulos_ativos)
 *   − MODULOS_RESERVADOS (módulos globalmente desligados)
 *   − quem perdeu a dependência (ex.: comissoes sem financeiro)
 *
 * Slugs inválidos em `extras` são silenciosamente ignorados.
 */
// Módulos verticais mutuamente exclusivos.
// Se a empresa escolheu um vertical (via modulos_ativos), os demais são removidos
// mesmo que estejam embutidos no plano (ex.: trial/interno têm tudo).
const VERTICAIS: Modulo[] = ['processos', 'obras']

export function modulosEfetivos(
  plano: PlanoEmpresa,
  extras: string[] = [],
): Set<Modulo> {
  const base = new Set<Modulo>(MODULOS_POR_PLANO[plano])

  // Adiciona extras válidos (ignora slugs que não existem em MODULOS)
  for (const e of extras) {
    if ((MODULOS as readonly string[]).includes(e)) {
      base.add(e as Modulo)
    }
  }

  // Isolamento de verticais: se um vertical está em extras (área escolhida pelo admin),
  // remove os outros verticais do conjunto — mesmo que estejam no plano base.
  const verticalAtivo = VERTICAIS.find((v) => extras.includes(v))
  if (verticalAtivo) {
    for (const v of VERTICAIS) {
      if (v !== verticalAtivo) base.delete(v)
    }
  }

  // Remove módulos reservados globalmente
  for (const r of MODULOS_RESERVADOS) {
    base.delete(r)
  }

  // Remove módulos que perderam a dependência
  for (const [mod, dep] of Object.entries(DEPENDENCIAS) as [Modulo, Modulo][]) {
    if (base.has(mod) && !base.has(dep)) {
      base.delete(mod)
    }
  }

  return base
}

/**
 * Verifica se um módulo específico está ativo para uma empresa.
 *
 * @param plano   - Plano atual da empresa
 * @param modulo  - Módulo a verificar
 * @param extras  - Slugs de add-ons/cortesia em empresas.modulos_ativos
 */
export function temModulo(
  plano: PlanoEmpresa,
  modulo: Modulo,
  extras: string[] = [],
): boolean {
  return modulosEfetivos(plano, extras).has(modulo)
}
