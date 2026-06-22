import { redirect } from 'next/navigation'
import { Settings, LayoutDashboard } from 'lucide-react'
import { CodigoAcesso } from '@/components/crm/configuracoes/codigo-acesso'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { UsuariosTable } from '@/components/crm/configuracoes/usuarios-table'
import { InviteUserForm } from '@/components/crm/configuracoes/invite-user-form'
import { MenuToggles } from '@/components/crm/configuracoes/menu-toggles'
import { PrivacidadeDados } from '@/components/crm/privacidade-dados'
import { ExcluirConta } from '@/components/crm/configuracoes/excluir-conta'
import { avaliarPagamento } from './actions'
import { ConfigSdrSection } from '@/components/crm/configuracoes/config-sdr-section'
import { modulosEfetivos } from '@/lib/modulos'
import type { Modulo } from '@/lib/modulos'
import type { PlanoEmpresa } from '@/lib/auth'
import type { Profile, Role } from '@/types'

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, empresa_id')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const admin = createAdminClient()

  const empresaId = profile?.empresa_id as string | null

  const [profilesResult, authUsersResult, empresaResult] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: true }),
    admin.auth.admin.listUsers(),
    empresaId
      ? supabase
          .from('empresas')
          .select('nome, status, encarregado_nome, encarregado_email, encarregado_telefone, aceite_termos_versao, aceite_termos_em, plano, modulos_ativos, modulos_ocultos, codigo_acesso, wa_phone_number_id, nome_escritorio, nome_assistente, tom_de_voz, sugestao_sdr')
          .eq('id', empresaId)
          .single()
      : Promise.resolve({ data: null, error: null }),
  ])

  // Status de pagamento (faturas em aberto + status da empresa) — calculado no
  // server; o componente usa só para UX. A regra é re-validada no server action.
  const pagamento = empresaId
    ? await avaliarPagamento(empresaId).catch(() => null)
    : null

  const profiles: Profile[] = (profilesResult.data ?? []) as Profile[]
  const authUsers = authUsersResult.data?.users ?? []

  const emailByUserId = new Map(authUsers.map((u) => [u.id, u.email ?? '']))

  const usuarios = profiles.map((p) => ({
    id: p.id,
    full_name: p.full_name,
    email: emailByUserId.get(p.id) ?? '—',
    role: p.role as Role,
    cargo: p.cargo ?? null,
    created_at: p.created_at,
  }))

  const empresa = empresaResult.data as {
    nome: string
    status: string
    encarregado_nome: string | null
    encarregado_email: string | null
    encarregado_telefone: string | null
    aceite_termos_versao: string | null
    aceite_termos_em: string | null
    plano: PlanoEmpresa | null
    modulos_ativos: string[] | null
    modulos_ocultos: string[] | null
    codigo_acesso: string | null
    wa_phone_number_id: string | null
    nome_escritorio:    string | null
    nome_assistente:    string | null
    tom_de_voz:         string | null
    sugestao_sdr:       string | null
  } | null

  const modulosDisponiveis = Array.from(
    modulosEfetivos(empresa?.plano ?? 'free', empresa?.modulos_ativos ?? [])
  ) as Modulo[]
  const modulosOcultos: string[] = empresa?.modulos_ocultos ?? []

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
            <Settings className="size-5 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground font-[family-name:var(--font-heading)]">Configurações</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Gerencie os usuários e permissões do CRM Studio.
            </p>
          </div>
        </div>
        <InviteUserForm />
      </div>

      <section className="flex flex-col gap-4">
        <div>
          <h3 className="text-base font-medium text-foreground">Usuários</h3>
          <p className="text-sm text-muted-foreground">
            {usuarios.length} {usuarios.length === 1 ? 'usuário cadastrado' : 'usuários cadastrados'}
          </p>
        </div>

        {profilesResult.error ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 py-10 text-center">
            <p className="text-sm text-destructive">
              Erro ao carregar usuários. Tente novamente mais tarde.
            </p>
          </div>
        ) : (
          <UsuariosTable usuarios={usuarios} currentUserId={user.id} />
        )}
      </section>

      <section>
        <details className="group rounded-xl border border-border">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 marker:hidden">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="size-4 text-muted-foreground" />
              <span className="text-base font-medium text-foreground">Personalizar menu</span>
            </div>
            <svg
              className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
              xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="flex flex-col gap-4 border-t border-border px-5 pb-5 pt-4">
            <p className="text-sm text-muted-foreground">
              Oculte módulos que sua empresa não usa. O acesso pela URL continua disponível.
            </p>
            <MenuToggles modulosDisponiveis={modulosDisponiveis} modulosOcultos={modulosOcultos} />
          </div>
        </details>
      </section>

      {empresa?.codigo_acesso && (
        <section>
          <CodigoAcesso codigo={empresa.codigo_acesso} />
        </section>
      )}

      <section className="flex flex-col gap-4">
        <PrivacidadeDados
          encarregadoNome={empresa?.encarregado_nome ?? null}
          encarregadoEmail={empresa?.encarregado_email ?? null}
          encarregadoTelefone={empresa?.encarregado_telefone ?? null}
          aceiteTermosVersao={empresa?.aceite_termos_versao ?? null}
          aceiteTermosEm={empresa?.aceite_termos_em ?? null}
          role={profile?.role ?? 'admin'}
        />
      </section>

      {/* SDR — aparece se o módulo SDR estiver ativo */}
      {modulosDisponiveis.includes('sdr' as Modulo) && (
        <section>
          <ConfigSdrSection
            config={{
              wa_phone_number_id: empresa?.wa_phone_number_id ?? null,
              nome_escritorio:    empresa?.nome_escritorio ?? null,
              nome_assistente:    empresa?.nome_assistente ?? null,
              tom_de_voz:         empresa?.tom_de_voz ?? null,
              sugestao_sdr:       empresa?.sugestao_sdr ?? null,
            }}
          />
        </section>
      )}

      {empresa?.nome && (
        <ExcluirConta
          empresaNome={empresa.nome}
          podeExcluir={pagamento?.podeExcluir ?? false}
          motivo={pagamento?.motivo ?? 'Não foi possível verificar o status de pagamento. Tente novamente mais tarde.'}
        />
      )}
    </div>
  )
}
