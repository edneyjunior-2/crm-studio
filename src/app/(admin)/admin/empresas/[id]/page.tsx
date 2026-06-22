import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { atualizarEmpresa } from '../actions'
import { ApiKeysSection } from './api-keys-section'
import { UsuariosSection } from './usuarios-section'
import { AreaAtuacaoSection } from './area-atuacao-section'
import { EditarNomeEmpresa } from './editar-nome'
import { ConfigSdrSection } from './config-sdr-section'

const PLANOS   = ['interno', 'trial', 'free', 'starter', 'pro', 'business']
const STATUSES = ['trial', 'ativo', 'pendente', 'atrasado', 'suspenso', 'cancelado']

const PLANO_LABEL: Record<string, string> = {
  interno:  'Interno (sem cobrança)',
  trial:    'Trial — 7 dias',
  free:     'Free',
  starter:  'Starter — R$ 149/mês',
  pro:      'Pro — R$ 449/mês',
  business: 'Business — R$ 990/mês',
}

const STATUS_LABEL: Record<string, string> = {
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
      .select('id, nome, plano, status, trial_ends_at, created_at, modulos_ativos')
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
    // Query separada para as colunas SDR — falha não afeta o carregamento da página
    db
      .from('empresas')
      .select('wa_phone_number_id, nome_escritorio, nome_assistente, tom_de_voz, sugestao_sdr')
      .eq('id', id)
      .maybeSingle(),
  ])

  const configSdr = sdrRaw
    ? {
        wa_phone_number_id: (sdrRaw as Record<string, unknown>).wa_phone_number_id as string | null,
        nome_escritorio:    (sdrRaw as Record<string, unknown>).nome_escritorio    as string | null,
        nome_assistente:    (sdrRaw as Record<string, unknown>).nome_assistente    as string | null,
        tom_de_voz:         (sdrRaw as Record<string, unknown>).tom_de_voz         as string | null,
        sugestao_sdr:       (sdrRaw as Record<string, unknown>).sugestao_sdr       as string | null,
      }
    : null

  if (!empresa) notFound()

  // Busca e-mails dos usuários via Auth (service role)
  const usuariosComEmail = await Promise.all(
    (profiles ?? []).map(async (p) => {
      const { data } = await db.auth.admin.getUserById(p.id)
      return { ...p, email: data.user?.email ?? '—' }
    })
  )

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
            <dt className="text-muted-foreground">Módulos extras</dt>
            <dd className="font-medium">
              {empresa.modulos_ativos?.length
                ? empresa.modulos_ativos.join(', ')
                : '—'}
            </dd>
          </div>
        </dl>
      </div>

      {/* Área de atuação — troca CRM Vendas <-> Advocacia */}
      <AreaAtuacaoSection
        empresaId={id}
        area={empresa.modulos_ativos?.includes('processos') ? 'advocacia' : 'vendas'}
      />

      {/* Usuários da empresa + botão de link de acesso */}
      <UsuariosSection usuarios={usuariosComEmail} />

      {/* Configuração do robô SDR (persona + tom de voz) */}
      <ConfigSdrSection empresaId={id} config={configSdr ?? null} />

      {/* API Keys / Integração SDR */}
      <ApiKeysSection empresaId={id} apiKeys={apiKeys ?? []} />
    </div>
  )
}
