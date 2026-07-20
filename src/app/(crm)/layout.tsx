import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import { acessoLiberado } from '@/lib/gating'
import { modulosEfetivos } from '@/lib/modulos'
import { createAdminClient } from '@/lib/supabase/admin'
import { contarConversasNaoLidas } from './atendimento/atendimento-actions'
import { listarReunioesPendentes, type ReuniaoPendente } from './reunioes-sdr-actions'
import { CRMShell } from '@/components/crm/crm-shell'
import { BannerAssinatura } from '@/components/crm/banner-assinatura'
import { Toaster } from '@/components/ui/sonner'
import { TourBoasVindas } from '@/components/crm/tour-boas-vindas'
import { SyncDataJudProvider } from '@/components/crm/sync-datajud-provider'
import { ReuniaoConfirmacaoPopup } from '@/components/crm/reuniao-confirmacao-popup'
import { resolverAvatarUrl } from '@/lib/avatar'
import type { Profile } from '@/types'

export default async function CRMLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, empresaId, isPlatformAdmin, plano, status, trialEndsAt, supabase, role, modulosPermitidos } = await getAuthUser()

  // Conta sem empresa → fluxo de vinculação
  // Platform admin sem empresa ativa → seletor de tenant (evita loop: /selecionar-empresa está fora deste grupo)
  // Usuário comum sem empresa → tela de código de acesso
  if (!empresaId) {
    if (isPlatformAdmin) redirect('/selecionar-empresa')
    else redirect('/entrar/empresa')
  }

  // Cadastro com cartão pendente de confirmação → volta pro checkout (não é o
  // paywall genérico de /assinatura, que espera trial/suspenso/cancelado).
  if (status === 'pendente_cartao') redirect('/cadastro/pagamento')

  // Assinatura suspensa/cancelada → paywall (sem loop: /assinatura fica fora deste grupo)
  if (!acessoLiberado(status)) redirect('/assinatura')

  // Calcula dias restantes de trial (usando getFullYear/getMonth/getDate para evitar toISOString)
  let diasRestantes: number | null = null
  if (trialEndsAt && status === 'trial') {
    const end = new Date(trialEndsAt)
    const now = new Date()
    const endMidnight = new Date(end.getFullYear(), end.getMonth(), end.getDate())
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    diasRestantes = Math.ceil((endMidnight.getTime() - todayMidnight.getTime()) / 86_400_000)
  }

  // Paralelize as duas queries independentes
  const [{ data: empresaData }, { data: profile }] = await Promise.all([
    supabase
      .from('empresas')
      .select('modulos_ativos, modulos_ocultos, nome, primeiro_acesso_em')
      .eq('id', empresaId)
      .single(),
    supabase
      .from('profiles')
      .select('id, full_name, role, created_at, senha_temporaria, avatar_path')
      .eq('id', user.id)
      .single(),
  ])

  if (!profile) redirect('/login')

  // Signed URL da foto de perfil (bucket privado) — resolvida uma vez aqui e
  // repassada pra Sidebar/Topbar via CRMShell. Nunca lança: null vira
  // fallback de iniciais na UI.
  const avatarUrl = await resolverAvatarUrl(supabase, profile.avatar_path)

  // Trava de completar 1º acesso (spec onboarding-senha-pos-pagamento, Parte
  // C+D): enquanto a senha ainda for a aleatória gerada no cadastro (nunca
  // trocada), a pessoa só pode acessar /definir-senha — nunca o CRM. Convites
  // e contas pré-existentes têm senha_temporaria=false por padrão (a coluna
  // só é setada true no ramo fundador do handle_new_user) e nunca caem aqui.
  // Fora do grupo (crm) — mesmo padrão de /assinatura e /cadastro/pagamento —
  // para não entrar em loop de redirect.
  if (profile.senha_temporaria) redirect('/definir-senha')

  // Registra o primeiro acesso do cliente ao CRM (fire-and-forget, idempotente)
  if (!empresaData?.primeiro_acesso_em && empresaId) {
    const adminDb = createAdminClient()
    adminDb
      .from('empresas')
      .update({ primeiro_acesso_em: new Date().toISOString() })
      .eq('id', empresaId)
      .is('primeiro_acesso_em', null)
      .then(() => {})
  }

  const modulosAtivosExtras: string[] = empresaData?.modulos_ativos ?? []
  const modulosOcultos: string[] = empresaData?.modulos_ocultos ?? []

  // Conjunto efetivo de módulos para esta empresa, subtraindo os que o admin optou por ocultar
  const modulosEmpresa = modulosEfetivos(plano, modulosAtivosExtras)
  // RBAC por usuário (inline): admin/null = sem restrição
  const modulosUsuario = (role === 'admin' || modulosPermitidos == null)
    ? modulosEmpresa
    : new Set([...modulosEmpresa].filter((m) => modulosPermitidos.includes(m)))
  const modulosAtivos = Array.from(modulosUsuario)
    .filter((m) => !modulosOcultos.includes(m))

  // Contagem inicial do badge de não lidas (item "WhatsApp") — só busca se o
  // módulo estiver ativo pra este usuário, pra não gerar query à toa. Falha
  // aqui não pode derrubar a página inteira: cai pra 0, o polling no client
  // corrige assim que conseguir.
  let unreadWhatsappInicial = 0
  if (modulosAtivos.includes('atendimentos')) {
    try {
      unreadWhatsappInicial = await contarConversasNaoLidas()
    } catch (err) {
      console.error('[layout] erro ao buscar contagem inicial de não lidas:', err)
    }
  }

  // Popup de confirmação de reunião (agendamento real da Leila) — gateado só
  // por "pode ser confirmante" (role admin/socio), NUNCA por módulo: quem
  // marca reunião via SDR são sempre as sócias/admin, nunca um comercial.
  let reunioesPendentesIniciais: ReuniaoPendente[] = []
  if (role === 'admin' || role === 'socio') {
    try {
      reunioesPendentesIniciais = await listarReunioesPendentes()
    } catch (err) {
      console.error('[layout] erro ao buscar reuniões pendentes iniciais:', err)
    }
  }

  return (
    <SyncDataJudProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        {/* Banner de aviso de assinatura (trial / pendente / atrasado) */}
        <BannerAssinatura status={status} diasRestantes={diasRestantes} />

        <CRMShell
          profile={profile as Profile}
          modulosAtivos={modulosAtivos}
          empresaId={empresaId}
          empresaNome={empresaData?.nome ?? null}
          isPlatformAdmin={isPlatformAdmin}
          unreadWhatsappInicial={unreadWhatsappInicial}
          avatarUrl={avatarUrl}
        >{children}</CRMShell>

        <Toaster richColors position="top-right" />
        <TourBoasVindas />
        <ReuniaoConfirmacaoPopup reunioesIniciais={reunioesPendentesIniciais} />
      </div>
    </SyncDataJudProvider>
  )
}

// TODO (2ª onda): adicionar checagem de temModulo nas Server Actions de cada módulo.
// TODO (2ª onda): adicionar RLS por módulo no banco (coluna modulo em tabelas gateadas).
