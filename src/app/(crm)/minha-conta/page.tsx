import { redirect } from 'next/navigation'
import { UserCircle, Scale, Briefcase, ArrowUpRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { resolverAvatarUrl } from '@/lib/avatar'
import { GoogleCalendarConnect } from '@/components/crm/google/google-calendar-connect'
import { GoogleConnectFeedback } from '@/components/crm/google/google-connect-feedback'
import { RefazerTourBtn } from '@/components/crm/refazer-tour-btn'
import { OabForm } from '@/components/crm/minha-conta/oab-form'
import { AvatarForm } from '@/components/crm/minha-conta/avatar-form'

// Site de marketing onde ficam os demais produtos/verticais do CRM Studio.
const SITE_PRODUTOS = 'https://www.crmstudio.com.br'

export default async function MinhaContaPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, google_refresh_token, empresa_id, oab_numero, oab_uf, avatar_path')
    .eq('id', user.id)
    .single()

  const avatarUrl = await resolverAvatarUrl(supabase, profile?.avatar_path)

  // Versão do produto (padrão p/ todas as contas): deriva dos módulos da empresa.
  // 'processos' ativo → CRM Advocacia; caso contrário → CRM de Vendas.
  let modulosAtivos: string[] = []
  if (profile?.empresa_id) {
    const { data: empresa } = await supabase
      .from('empresas')
      .select('modulos_ativos')
      .eq('id', profile.empresa_id)
      .single()
    modulosAtivos = empresa?.modulos_ativos ?? []
  }
  const ehAdvocacia = modulosAtivos.includes('processos')
  const crm = ehAdvocacia
    ? {
        nome: 'CRM Advocacia',
        descricao: 'Processos jurídicos (DataJud), clientes, agenda e financeiro do escritório.',
        Icon: Scale,
      }
    : {
        nome: 'CRM de Vendas',
        descricao: 'Pipeline de vendas, clientes, financeiro e contratos.',
        Icon: Briefcase,
      }

  const params = await searchParams
  const googleStatus = params.google

  const roleLabel: Record<string, string> = {
    admin: 'Administrador',
    socio: 'Sócio',
    comercial: 'Comercial',
    parceiro: 'Parceiro',
  }

  return (
    <div className="flex flex-col gap-8">
      <GoogleConnectFeedback status={googleStatus} />

      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed URL do Storage, não é um asset estático
            <img src={avatarUrl} alt={profile?.full_name ?? 'Foto de perfil'} className="size-full object-cover" />
          ) : (
            <UserCircle className="size-5 text-muted-foreground" />
          )}
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground font-[family-name:var(--font-heading)]">
            Minha Conta
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Gerencie suas preferências e integrações.
          </p>
        </div>
      </div>

      {/* Informações do perfil */}
      <section className="flex flex-col gap-4">
        <div>
          <h3 className="text-base font-medium text-foreground">Perfil</h3>
          <p className="text-sm text-muted-foreground">Suas informações no CRM Studio.</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <AvatarForm avatarUrl={avatarUrl} nome={profile?.full_name ?? user.email ?? ''} />
          <div className="mt-4 grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Nome</p>
              <p className="mt-1 text-sm font-medium text-foreground">{profile?.full_name ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Perfil de acesso</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {profile?.role ? (roleLabel[profile.role] ?? profile.role) : '—'}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">E-mail</p>
              <p className="mt-1 text-sm font-medium text-foreground">{user.email ?? '—'}</p>
            </div>
          </div>
        </div>
      </section>

      {/* OAB — só para tenants com o módulo de Processos (advocacia) ativo */}
      {ehAdvocacia && (
        <section className="flex flex-col gap-4">
          <div>
            <h3 className="text-base font-medium text-foreground">OAB</h3>
            <p className="text-sm text-muted-foreground">
              Seu registro na Ordem dos Advogados do Brasil.
            </p>
          </div>
          <OabForm oabNumero={profile?.oab_numero ?? null} oabUf={profile?.oab_uf ?? null} />
        </section>
      )}

      {/* Versão do produto */}
      <section className="flex flex-col gap-4">
        <div>
          <h3 className="text-base font-medium text-foreground">Seu produto</h3>
          <p className="text-sm text-muted-foreground">A versão do CRM Studio contratada por esta conta.</p>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <crm.Icon className="size-5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{crm.nome}</p>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                Sua versão
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{crm.descricao}</p>
          </div>
        </div>
      </section>

      {/* Outros produtos */}
      <section className="flex flex-col gap-4">
        <div>
          <h3 className="text-base font-medium text-foreground">Conheça nossos outros produtos</h3>
          <p className="text-sm text-muted-foreground">
            Temos versões do CRM Studio para diferentes segmentos. Veja qual combina com o seu negócio.
          </p>
        </div>
        <a
          href={SITE_PRODUTOS}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Ver todos os produtos CRM Studio</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Advocacia, Vendas e outras soluções — abra para conhecer.
            </p>
          </div>
          <ArrowUpRight className="size-5 shrink-0 text-muted-foreground" />
        </a>
      </section>

      {/* Integrações */}
      <section className="flex flex-col gap-4">
        <div>
          <h3 className="text-base font-medium text-foreground">Integrações</h3>
          <p className="text-sm text-muted-foreground">
            Conecte ferramentas externas para automatizar seu fluxo de trabalho.
          </p>
        </div>
        <GoogleCalendarConnect isConnected={!!profile?.google_refresh_token} />
      </section>

      {/* Tour guiado */}
      <section className="flex flex-col gap-4">
        <div>
          <h3 className="text-base font-medium text-foreground">Ajuda</h3>
          <p className="text-sm text-muted-foreground">
            Precisa de um lembrete de como o sistema funciona?
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-medium text-foreground">Tour guiado</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Reveja a apresentação de cada módulo do sistema.
            </p>
          </div>
          <RefazerTourBtn />
        </div>
      </section>
    </div>
  )
}
