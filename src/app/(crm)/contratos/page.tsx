import { getAuthUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { ContratosView } from '@/components/crm/contratos/contratos-view'
import { listarContratosGerados } from './actions'

export default async function ContratosPage() {
  const { empresaId } = await getAuthUser()

  let templateUrl: string | null = null
  let emRevisao = false

  if (empresaId) {
    const db = createAdminClient()
    const { data: empresa } = await db
      .from('empresas')
      .select('config')
      .eq('id', empresaId)
      .single()

    const config = (empresa?.config as Record<string, unknown> | null) ?? {}
    const templatePath = config.contrato_template_path as string | undefined
    const aprovado     = config.contrato_aprovado as boolean | undefined

    if (templatePath && aprovado) {
      // Proxy same-origin autenticado (/api/contratos/template) em vez de signed
      // URL direta do Storage: Supabase serve .html como text/plain por padrão
      // (proteção anti-XSS), o que fazia o navegador mostrar o código-fonte em
      // vez de renderizar. A rota busca os bytes no servidor e corrige o
      // Content-Type.
      templateUrl = '/api/contratos/template'
    } else if (templatePath && !aprovado) {
      // Modelo existe mas ainda não foi liberado
      emRevisao = true
    } else if (!templatePath) {
      // Sem modelo via bucket — fallback para contrato_url legado (ex.: Aurum)
      templateUrl = (config.contrato_url as string | undefined) ?? null
    }
  }

  const historico = await listarContratosGerados()

  return <ContratosView templateUrl={templateUrl} emRevisao={emRevisao} historico={historico} />
}
