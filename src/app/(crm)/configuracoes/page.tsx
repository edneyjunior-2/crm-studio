import { redirect } from 'next/navigation'
import { Settings, LayoutDashboard, GitMerge, Briefcase, Scale } from 'lucide-react'
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
import { DadosEmpresaSection } from '@/components/crm/configuracoes/dados-empresa-section'
import { AddonAssinaturaCard } from '@/components/crm/configuracoes/addon-assinatura-card'
import { BlocoUsuariosCard } from '@/components/crm/configuracoes/bloco-usuarios-card'
import { ADDON_ASSINATURA } from '@/lib/addons'
import { temAddon, limiteUsuariosEfetivo } from '@/lib/addons-server'
import { modulosEfetivos, MODULO_LABEL, LIMITES_POR_PLANO } from '@/lib/modulos'
import type { Modulo } from '@/lib/modulos'
import { getAuthUser } from '@/lib/auth'
import type { PlanoEmpresa } from '@/lib/auth'
import type { Profile, Role } from '@/types'
import { listarEstagios } from '@/lib/pipeline-estagios'
import { EtapasConfig } from '@/components/crm/configuracoes/etapas-config'
import { getPipelineConfig } from '@/lib/pipeline-config'
import { PipelineConfigSection } from '@/components/crm/configuracoes/pipeline-config-section'
import { getProcessosConfig } from '@/lib/processos-config'
import { ProcessosConfigSection } from '@/components/crm/configuracoes/processos-config-section'
import { FotoWhatsappSection } from '@/components/crm/configuracoes/foto-whatsapp-section'
import { obterFotoPerfilWhatsApp, uploadFotoWhatsAppConfigurado, obterPerfilComercialWhatsApp } from '@/lib/whatsapp-cloud'

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

  // Tenant efetivo: para platform admin reflete empresa_ativa_id; para usuário
  // comum é igual a profiles.empresa_id. NÃO reler profiles.empresa_id direto —
  // daria vazio/órfão p/ platform admin. (ver atendimento/page.tsx)
  const { empresaId, plano } = await getAuthUser()

  const [profilesResult, authUsersResult, empresaResult, sdrResult, temAssinaturaEletronica, limiteUsuarios] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: true }),
    // E-mail + último acesso vêm da view profiles_auth (banco, via service_role),
    // NÃO de auth.admin.listUsers() (GoTrue) — que falhava em prod e zerava todos
    // os e-mails. Ver migration 20260629160000_profiles_auth_view.
    admin.from('profiles_auth').select('id, email, last_sign_in_at'),
    empresaId
      ? supabase
          .from('empresas')
          .select('nome, status, encarregado_nome, encarregado_email, encarregado_telefone, aceite_termos_versao, aceite_termos_em, plano, modulos_ativos, modulos_ocultos, codigo_acesso, sugestao_sdr, razao_social, nome_fantasia, cnpj')
          .eq('id', empresaId)
          .single()
      : Promise.resolve({ data: null, error: null }),
    // Persona do SDR vive em clientes_sdr (mesma tabela que o bot lê), não em empresas
    empresaId
      ? admin
          .from('clientes_sdr')
          .select('wa_phone_number_id, nome_escritorio, nome_assistente, tom_de_voz, topicos_proibidos, horario_inicio, horario_fim, dias_uteis, palavras_chave_handoff, mensagem_fora_horario, mensagem_handoff')
          .eq('empresa_id', empresaId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // Add-on de assinatura eletrônica (spec addon-assinatura-eletronica-zapsign.md)
    empresaId ? temAddon(admin, empresaId, ADDON_ASSINATURA) : Promise.resolve(false),
    // Limite efetivo de usuários (plano base + blocos comprados — spec addon-bloco-10-usuarios.md)
    empresaId ? limiteUsuariosEfetivo(admin, empresaId, plano) : Promise.resolve(LIMITES_POR_PLANO[plano].usuarios),
  ])

  // blocosComprados só é significativo quando limiteUsuarios !== -1 (plano
  // ilimitado não conta blocos — ver limiteUsuariosEfetivo).
  const blocosComprados = limiteUsuarios === -1 ? 0 : Math.round((limiteUsuarios - LIMITES_POR_PLANO[plano].usuarios) / 10)

  const sdr = (sdrResult.data ?? null) as {
    wa_phone_number_id:      string | null
    nome_escritorio:         string | null
    nome_assistente:         string | null
    tom_de_voz:              string | null
    topicos_proibidos:       string | null
    horario_inicio:          string | null
    horario_fim:             string | null
    dias_uteis:              number[] | null
    palavras_chave_handoff:  string | null
    mensagem_fora_horario:   string | null
    mensagem_handoff:        string | null
  } | null

  // Status de pagamento (faturas em aberto + status da empresa) — calculado no
  // server; o componente usa só para UX. A regra é re-validada no server action.
  const pagamento = empresaId
    ? await avaliarPagamento(empresaId).catch(() => null)
    : null

  // Etapas do funil — só as ativas (false = sem inativos)
  const estagios = await listarEstagios(false)

  // Obrigatórios do form de negócio (empresas.config.pipeline) — defaults quando não configurado
  const pipelineConfig = await getPipelineConfig(supabase, empresaId)

  // Advogado padrão do módulo Processos (empresas.config.processos) — defaults quando não configurado
  const processosConfig = await getProcessosConfig(supabase, empresaId)

  const profiles: Profile[] = (profilesResult.data ?? []) as Profile[]
  const authInfo = (authUsersResult.data ?? []) as { id: string; email: string | null; last_sign_in_at: string | null }[]

  const emailByUserId = new Map(authInfo.map((u) => [u.id, u.email ?? '']))
  const pendenteByUserId = new Map(authInfo.map((u) => [u.id, !u.last_sign_in_at]))

  const usuarios = profiles.map((p) => ({
    id: p.id,
    full_name: p.full_name,
    email: emailByUserId.get(p.id) ?? '—',
    role: p.role as Role,
    cargo: p.cargo ?? null,
    modulos_permitidos: (p as { modulos_permitidos?: string[] | null }).modulos_permitidos ?? null,
    created_at: p.created_at,
    pendente: pendenteByUserId.get(p.id) ?? false,
  }))

  let empresa = empresaResult.data as {
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
    razao_social:       string | null
    nome_fantasia:      string | null
    cnpj:               string | null
  } | null

  // Auto-gera código de acesso se a empresa ainda não tiver um
  if (empresa && !empresa.codigo_acesso && empresaId) {
    const prefixo = (empresa.nome ?? 'EMP')
      .replace(/[^a-zA-Z]/g, '')
      .slice(0, 3)
      .toUpperCase()
      .padEnd(3, 'X')
    const sufixo = String(Math.floor(1000 + Math.random() * 9000))
    const novoCode = `${prefixo}-${sufixo}`
    const { error: codeErr } = await admin
      .from('empresas')
      .update({ codigo_acesso: novoCode })
      .eq('id', empresaId)
    if (!codeErr) {
      empresa = { ...empresa, codigo_acesso: novoCode }
    }
  }

  const modulosDisponiveis = Array.from(
    modulosEfetivos(empresa?.plano ?? 'free', empresa?.modulos_ativos ?? [])
  ) as Modulo[]
  const modulosEmpresa = modulosDisponiveis.map((slug) => ({ slug, label: MODULO_LABEL[slug] }))
  const modulosOcultos: string[] = empresa?.modulos_ocultos ?? []

  // Foto do perfil comercial do WhatsApp — só para quem tem o módulo de
  // atendimento (sdr): as credenciais são as do número da empresa, e a foto
  // trocada aqui aparece para os clientes no WhatsApp deles.
  const temAtendimento = modulosDisponiveis.includes('sdr' as Modulo)
  const fotoWa = temAtendimento ? await obterFotoPerfilWhatsApp() : null
  const perfilWa = temAtendimento ? await obterPerfilComercialWhatsApp() : null

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
            {usuarios.length} de {limiteUsuarios === -1 ? '∞' : limiteUsuarios} usuários
          </p>
        </div>

        {limiteUsuarios !== -1 && (
          <BlocoUsuariosCard blocosComprados={blocosComprados} podeComprar={profile?.role === 'admin'} />
        )}

        {profilesResult.error ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 py-10 text-center">
            <p className="text-sm text-destructive">
              Erro ao carregar usuários. Tente novamente mais tarde.
            </p>
          </div>
        ) : (
          <UsuariosTable usuarios={usuarios} currentUserId={user.id} modulosEmpresa={modulosEmpresa} />
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

      <section>
        <DadosEmpresaSection
          nomeFantasia={empresa?.nome_fantasia ?? null}
          razaoSocial={empresa?.razao_social ?? null}
          cnpj={empresa?.cnpj ?? null}
        />
      </section>

      <section>
        <AddonAssinaturaCard ativo={temAssinaturaEletronica} />
      </section>

      <section>
        <details className="group rounded-xl border border-border">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 marker:hidden">
            <div className="flex items-center gap-2">
              <GitMerge className="size-4 text-muted-foreground" />
              <span className="text-base font-medium text-foreground">Etapas do funil</span>
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
              Personalize as etapas do seu funil de vendas. A ordem aqui reflete a ordem no Kanban.
              Toda etapa deve ter pelo menos um tipo <strong>Ganho</strong> e um tipo <strong>Perdido</strong>.
            </p>
            <EtapasConfig estagios={estagios} />
          </div>
        </details>
      </section>

      <section>
        <details className="group rounded-xl border border-border">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 marker:hidden">
            <div className="flex items-center gap-2">
              <Briefcase className="size-4 text-muted-foreground" />
              <span className="text-base font-medium text-foreground">Pipeline / Negócios</span>
            </div>
            <svg
              className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
              xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="flex flex-col gap-4 border-t border-border px-5 pb-5 pt-4">
            <PipelineConfigSection config={pipelineConfig} />
          </div>
        </details>
      </section>

      {/* Vertical advocacia — some da página inteira sem o módulo, não só desabilita */}
      {modulosDisponiveis.includes('processos' as Modulo) && (
        <section>
          <details className="group rounded-xl border border-border">
            <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 marker:hidden">
              <div className="flex items-center gap-2">
                <Scale className="size-4 text-muted-foreground" />
                <span className="text-base font-medium text-foreground">Advogado responsável padrão</span>
              </div>
              <svg
                className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
                xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="flex flex-col gap-4 border-t border-border px-5 pb-5 pt-4">
              <ProcessosConfigSection
                advogados={profiles
                  .map((p) => ({ id: p.id, full_name: p.full_name }))
                  .sort((a, b) => a.full_name.localeCompare(b.full_name, 'pt-BR'))}
                advogadoPadraoId={processosConfig.advogado_padrao_id}
              />
            </div>
          </details>
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

      {/* Foto do WhatsApp — só para quem tem o módulo de atendimento ativo */}
      {temAtendimento && (
        <section>
          <FotoWhatsappSection
            fotoUrl={fotoWa?.ok ? fotoWa.url : null}
            integracaoOk={(fotoWa?.ok ?? false) && uploadFotoWhatsAppConfigurado()}
            perfil={perfilWa?.ok ? perfilWa.perfil : null}
            perfilOk={perfilWa?.ok ?? false}
          />
        </section>
      )}

      {/* SDR — aparece sempre; desabilitado se módulo não estiver ativo */}
      <section>
        <ConfigSdrSection
          ativo={modulosDisponiveis.includes('sdr' as Modulo)}
          config={{
            wa_phone_number_id:     sdr?.wa_phone_number_id ?? null,
            nome_escritorio:        sdr?.nome_escritorio ?? null,
            nome_assistente:        sdr?.nome_assistente ?? null,
            tom_de_voz:             sdr?.tom_de_voz ?? null,
            topicos_proibidos:      sdr?.topicos_proibidos ?? null,
            horario_inicio:         sdr?.horario_inicio ?? null,
            horario_fim:            sdr?.horario_fim ?? null,
            dias_uteis:             sdr?.dias_uteis ?? null,
            palavras_chave_handoff: sdr?.palavras_chave_handoff ?? null,
            mensagem_fora_horario:  sdr?.mensagem_fora_horario ?? null,
            mensagem_handoff:       sdr?.mensagem_handoff ?? null,
            sugestao_sdr:           empresa?.sugestao_sdr ?? null,
          }}
        />
      </section>

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
