import { createElement, type CSSProperties, type ReactNode } from 'react'

/**
 * Timbrado (cabeçalho institucional) por empresa — helper compartilhado pelos
 * documentos imprimíveis (orçamento de obra, extrato de clientes de solução).
 *
 * Padrão igual ao gerador de contratos white-label: bucket privado no Supabase
 * Storage + signed URL sob demanda + path guardado em `empresas.config` (jsonb),
 * chave `timbrado_path`. Ver `20260629190000_contratos_whitelabel.sql` e o
 * consumo em `src/app/(crm)/contratos/page.tsx`.
 */

/**
 * Resolve a signed URL (1h) do timbrado da empresa. Retorna `null` quando não
 * há `empresaId`, não há timbrado configurado, ou a resolução falha por
 * qualquer motivo — NUNCA lança: o documento sempre degrada para "sem
 * timbrado" em vez de quebrar a renderização.
 */
export async function resolverTimbradoUrl(empresaId: string | null): Promise<string | null> {
  if (!empresaId) return null

  // Import dinâmico: mantém `createAdminClient` (service-role) fora do bundle
  // client — este módulo é importado pelos documentos, que são 'use client'.
  // Import estático no topo vazaria o admin client pro bundle do navegador.
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const db = createAdminClient()

  const { data: empresa } = await db
    .from('empresas')
    .select('config')
    .eq('id', empresaId)
    .single()

  const config = (empresa?.config as Record<string, unknown> | null) ?? {}
  const path = config.timbrado_path as string | undefined
  if (!path) return null

  const { data } = await db.storage.from('timbrados').createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}

// print-color-adjust: exact garante que a imagem saia na impressão/PDF (o
// navegador por padrão pode omitir imagens "decorativas" ao imprimir).
const TIMBRADO_STYLE: CSSProperties = {
  WebkitPrintColorAdjust: 'exact',
  printColorAdjust: 'exact',
}

/**
 * Cabeçalho de timbrado (imagem) a renderizar no topo do documento, antes do
 * cabeçalho institucional textual (nome/CNPJ) que cada documento já tem. Sem
 * `url`, não renderiza nada — o documento fica idêntico ao comportamento atual.
 *
 * ponytail: escrito com `createElement` (sem sintaxe JSX) porque este arquivo
 * é `.ts` (path fixado na lane da spec) — `.ts` não parseia JSX, só `.tsx`.
 * Continua um componente puro: sem hooks, sem import server-only no topo do
 * módulo (o admin client só é tocado dentro de `resolverTimbradoUrl`, via
 * import dinâmico).
 */
export function TimbradoHeader({ url }: { url: string | null }): ReactNode {
  if (!url) return null
  return createElement(
    'div',
    { className: 'mb-4', style: TIMBRADO_STYLE },
    createElement('img', {
      src: url,
      alt: 'Timbrado',
      className: 'w-full max-h-32 object-contain',
    }),
  )
}
