import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { ParceirosGrid } from '@/components/crm/parceiros/parceiros-grid'
import { ParceiroForm } from '@/components/crm/parceiros/parceiro-form'
import { ContratoPrazoAlert } from '@/components/crm/parceiros/contrato-prazo-alert'
import type { Parceiro } from '@/types'

export default async function ParceirosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const canEdit = profile?.role === 'admin' || profile?.role === 'socio'

  const [{ data: parceiros, error }, { data: profiles }] = await Promise.all([
    supabase
      .from('parceiros')
      .select('*, responsavel:profiles!responsavel_id(full_name)')
      .order('nome', { ascending: true }),
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .order('full_name'),
  ])

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold tracking-tight font-[family-name:var(--font-heading)]">Parceiros</h1>
        <p className="text-destructive">Erro ao carregar parceiros. Tente novamente.</p>
      </div>
    )
  }

  const profilesTodos = (profiles ?? []) as { id: string; full_name: string; role: string }[]
  // "Responsável" é o dono interno do relacionamento — parceiro externo não entra.
  const profilesList = profilesTodos
    .filter((p) => p.role !== 'parceiro')
    .map(({ id, full_name }) => ({ id, full_name }))
  // Candidatos a login do portal: só quem tem role 'parceiro'.
  const usuariosParceiro = profilesTodos
    .filter((p) => p.role === 'parceiro')
    .map(({ id, full_name }) => ({ id, full_name }))

  const agora = new Date()
  const parceirosPendentes = (parceiros ?? [])
    .filter((p) => {
      if (p.contrato_url) return false
      if (p.responsavel_id !== user.id) return false
      const criado = new Date(p.created_at)
      const diasDesde = Math.floor((agora.getTime() - criado.getTime()) / (1000 * 60 * 60 * 24))
      return diasDesde >= 5
    })
    .map((p) => ({
      id: p.id as string,
      nome: p.nome as string,
      diasAtraso: Math.floor((agora.getTime() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24)) - 5,
    }))

  return (
    <div className="flex flex-col gap-6">
      <ContratoPrazoAlert parceiros={parceirosPendentes} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-[family-name:var(--font-heading)]">Parceiros</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie os parceiros e indicadores do CRM.
          </p>
        </div>
        {canEdit && (
          <ParceiroForm
            profiles={profilesList}
            usuariosParceiro={usuariosParceiro}
            currentUserId={user.id}
            trigger={
              <Button>
                <Plus className="mr-2 size-4" />
                Novo Parceiro
              </Button>
            }
          />
        )}
      </div>

      <ParceirosGrid
        parceiros={(parceiros ?? []) as Parceiro[]}
        canEdit={canEdit}
        profiles={profilesList}
        usuariosParceiro={usuariosParceiro}
        currentUserId={user.id}
      />
    </div>
  )
}
