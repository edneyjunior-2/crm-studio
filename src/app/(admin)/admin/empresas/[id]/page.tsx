import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { atualizarEmpresa, salvarValorMensalidade } from '../actions'
import { ApiKeysSection } from './api-keys-section'
import { UsuariosSection } from './usuarios-section'
import { AreaAtuacaoSection } from './area-atuacao-section'
import { EditarNomeEmpresa } from './editar-nome'
import { ConfigSdrSection } from './config-sdr-section'
import { ModeloContratoSection } from './modelo-contrato-section'

const PLANOS   = ['interno', 'trial', 'free', 'starter', 'pro', 'business']
const STATUSES = ['pendente_cartao', 'trial', 'ativo', 'pendente', 'atrasado', 'suspenso', 'cancelado']

const PLANO_LABEL: Record<string, string> = {
  interno:  'Interno (sem cobrança)',
  trial:    'Trial — 7 dias',
  free:     'Free',
  starter:  'Starter — R$ 149/mês',
  pro:      'Pro — R$ 449/mês',
  business: 'Business — R$ 990/mês',
}

const STATUS_LABEL: Record<string, string> = {
  pendente_cartao: 'Aguardando cartão',
  trial:    'Trial',
  ativo:    'Ativo',
  pendente: 'Pendente',
  atrasado: 'Atrasado',
  suspenso: 'Suspenso',
  cancelado:'Cancelado',
}

export default async function EmpresaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // Layout já faz getAuthPlatformAdmin() — não precisamos chamar de novo

  const { id } = await params
  const db = createAdminClient()

  const [{ data: empresa }, { data: apiKeys }, { data: profiles }, { data: sdrRaw }] = await Promise.all([
    db
      .from('empresas')
      .select('id, nome, plano, status, trial_ends_at, created_at, modulos_ativos, valor_mensalidade, primeiro_acesso_em, sugestao_sdr, config')
      .eq('id', id)
      .single(),
    db
      .from('api_keys')
      .select('id, label, created_at')
      .eq('empresa_id', id)
      .order('created_at', { ascending: false }),
    db
      .from('profiles')
      .select('id, full_name, role, created_at')
      .eq('empresa_id', id)
      .order('created_at'),
    // Persona do SDR vive em clientes_sdr (mesma tabela que o bot lê), não em empresas
    db
      .from('clientes_sdr')
      .select('wa_phone_number_id, nome_escritorio, nome_assistente, tom_de_voz')
      .eq('empresa_id', id)
      .maybeSingle(),
  ])

  const configSdr = sdrRaw
    ? {
        wa_phone_number_id: (sdrRaw as Record<string, unknown>).wa_phone_number_id as string | null,
        nome_escritorio:    (sdrRaw as Record<string, unknown>).nome_escritorio    as string | null,
        nome_assistente:    (sdrRaw as Record<string, unknown>).nome_assistente    as string | null,
        tom_de_voz:         (sdrRaw as Record<string, unknown>).tom_de_voz         as string | null,
        sugestao_sdr:       (empresa as Record<string, unknown>)?.sugestao_sdr     as string | null,
      }
    : null

  if (!empresa) notFound()

  // Busca e-mails dos usuários via VIEW profiles_auth (service role, query única)
  // NÃO usar db.auth.admin.getUserById() em loop — N+1 GoTrue volta vazio em prod.
  const ids = (profiles ?? []).map((p) => p.id)
  const { data: authRows } = ids.length > 0
    ? await db.from('profiles_auth').select('id, email, last_sign_in_at').in('id', ids)
    : { data: [] as { id: string; email: string | null; last_sign_in_at: string | null }[] }

  const authByIdMap = new Map((authRows ?? []).map((r) => [r.id, r]))

  const usuariosComEmail = (profiles ?? []).map((p) => ({
    ...p,
    email: authByIdMap.get(p.id)?.email ?? '—',
  }))

  const atualizarComId = atualizarEmpresa.bind(null, id)

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/empresas"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Voltar
        </Link>
      </div>

      <div>
        <EditarNomeEmpresa empresaId={empresa.id} nome={empresa.nome} />
        <p className="mt-1 font-mono text-xs text-muted-foreground">{empresa.id}</p>
      </div>

      {/* Info + ações */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Mudar status */}
        <form
          action={atualizarComId}
          className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5"
        >
          <h2 className="text-sm font-semibold">Status de acesso</h2>
          <select
            name="status"
            defaultValue={empresa.status}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90"
          >
            Salvar status
          </button>
        </form>

        {/* Mudar plano */}
        <form
          action={atualizarComId}
          className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5"
        >
          <h2 className="text-sm font-semibold">Plano contratado</h2>
          <select
            name="plano"
            defaultValue={empresa.plano}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40"
          >
            {PLANOS.map((p) => (
              <option key={p} value={p}>{PLANO_LABEL[p] ?? p}</option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90"
          >
            Salvar plano
          </button>
        </form>
      </div>

      {/* Metadados */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold">Informações</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Trial vence</dt>
            <dd className="font-medium">
              {empresa.trial_ends_at
                ? new Date(empresa.trial_ends_at).toLocaleDateString('pt-BR')
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Criada em</dt>
            <dd className="font-medium">
              {new Date(empresa.created_at).toLocaleDateString('pt-BR')}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">1º acesso ao CRM</dt>
            <dd className="font-medium">
              {(empresa as Record<string, unknown>).primeiro_acesso_em
                ? new Date((empresa as Record<string, unknown>).primeiro_acesso_em as string).toLocaleDateString('pt-BR')
                : <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">Aguardando</span>}
            </dd>
          </div>
        </dl>
      </div>

      {/* Mensalidade acordada (faturamento fora do sistema) */}
      <form
        action={salvarValorMensalidade.bind(null, id)}
        className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5"
      >
        <div>
          <h2 className="text-sm font-semibold">Mensalidade (MRR)</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Valor acordado com o cliente. Usado no cálculo do MRR do dashboard admin.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">R$</span>
          <input
            name="valor_mensalidade"
            type="text"
            inputMode="decimal"
            defaultValue={
              (empresa as Record<string, unknown>).valor_mensalidade != null
                ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
                    Number((empresa as Record<string, unknown>).valor_mensalidade),
                  )
                : ''
            }
            placeholder="0,00"
            className="w-40 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40"
          />
          <button
            type="submit"
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90"
          >
            Salvar
          </button>
        </div>
      </form>

      {/* Área de atuação */}
      <AreaAtuacaoSection
        empresaId={id}
        area={
          empresa.modulos_ativos?.includes('processos')
            ? 'advocacia'
            : empresa.modulos_ativos?.includes('obras')
              ? 'engenharia'
              : 'vendas'
        }
      />

      {/* Usuários da empresa + botão de link de acesso */}
      <UsuariosSection usuarios={usuariosComEmail} empresaId={id} />

      {/* Configuração do robô SDR (persona + tom de voz) */}
      <ConfigSdrSection empresaId={id} config={configSdr ?? null} />

      {/* Modelo de contrato white-label */}
      <ModeloContratoSection
        empresaId={id}
        templatePath={
          ((empresa as Record<string, unknown>).config as Record<string, unknown> | null)
            ?.contrato_template_path as string | null ?? null
        }
        aprovado={
          !!(((empresa as Record<string, unknown>).config as Record<string, unknown> | null)
            ?.contrato_aprovado)
        }
      />

      {/* API Keys / Integração SDR */}
      <ApiKeysSection empresaId={id} apiKeys={apiKeys ?? []} />
    </div>
  )
}
