import { getAuthUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { ContratosView } from '@/components/crm/contratos/contratos-view'
import { listarContratosGerados } from './actions'
import { ADDON_ASSINATURA } from '@/lib/addons'
import { temAddon } from '@/lib/addons-server'

export default async function ContratosPage() {
  const { empresaId, role } = await getAuthUser()

  let templateUrl: string | null = null
  let emRevisao = false
  // Sem responsável pela assinatura cadastrado, o envio pro ZapSign é bloqueado
  // (ver enviarParaAssinatura em ./actions.ts) — a view avisa antes de o usuário
  // perder tempo preenchendo o contrato.
  let assinaturaConfigurada = false
  let signatarioNome  = ''
  let signatarioEmail = ''
  // Add-on de assinatura eletrônica (R$49/mês — spec
  // addon-assinatura-eletronica-zapsign.md). Sem empresa (conta órfã) não há
  // como ter o add-on — default false (fail-closed, mesmo espírito de temAddon).
  let temAssinaturaEletronica = false

  if (empresaId) {
    const db = createAdminClient()
    const [{ data: empresa }, addonOk] = await Promise.all([
      db.from('empresas').select('config').eq('id', empresaId).single(),
      temAddon(db, empresaId, ADDON_ASSINATURA),
    ])
    temAssinaturaEletronica = addonOk

    const config = (empresa?.config as Record<string, unknown> | null) ?? {}
    const templatePath = config.contrato_template_path as string | undefined
    const aprovado     = config.contrato_aprovado as boolean | undefined
    signatarioNome  = (config.contrato_signatario_nome  as string | undefined)?.trim() ?? ''
    signatarioEmail = (config.contrato_signatario_email as string | undefined)?.trim() ?? ''
    assinaturaConfigurada = !!(signatarioNome && signatarioEmail)

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

  return (
    <ContratosView
      templateUrl={templateUrl}
      emRevisao={emRevisao}
      historico={historico}
      assinaturaConfigurada={assinaturaConfigurada}
      podeConfigurarAssinatura={role === 'admin' || role === 'socio'}
      signatarioNome={signatarioNome}
      signatarioEmail={signatarioEmail}
      temAssinaturaEletronica={temAssinaturaEletronica}
      empresaId={empresaId}
    />
  )
}
