import { getAuthUser } from '@/lib/auth'
import { ContratosView } from '@/components/crm/contratos/contratos-view'

export default async function ContratosPage() {
  const { supabase, empresaId } = await getAuthUser()

  let templateUrl: string | null = null
  if (empresaId) {
    const { data: empresa } = await supabase
      .from('empresas')
      .select('config')
      .eq('id', empresaId)
      .single()
    templateUrl = (empresa?.config as Record<string, string> | null)?.contrato_url ?? null
  }

  return <ContratosView templateUrl={templateUrl} />
}
