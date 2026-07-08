import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Scale, UserCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { ReatribuirSelect } from './reatribuir-select'
import { StatusBadge } from '@/components/ui/status-badge'
import { variantStatusProcesso, labelStatusProcesso } from '@/lib/processos-status'
import { areaToSlug } from '../page'

const AREA_LABELS: Record<string, string> = {
  tributario:      'Tributário',
  previdenciario:  'Previdenciário',
  precatorio:      'Precatório',
  fazenda_publica: 'Fazenda Pública',
  trabalhista:     'Trabalhista',
  criminal:        'Criminal',
  familia:         'Família',
  administrativo:  'Administrativo',
  civel:           'Cível',
  outro:           'Outro',
}

export default async function ResponsabilidadesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const [
    { data: perfil },
    { data: profiles },
  ] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    // RLS scoped: traz apenas profiles da mesma empresa
    supabase.from('profiles').select('id, full_name'),
  ])

  const isAdmin = perfil?.role === 'admin' || perfil?.role === 'socio'

  // E-mails via view profiles_auth (service-role) — NÃO admin.auth.admin.listUsers()
  // (GoTrue), que falha/retorna vazio em produção neste projeto.
  const profileIds = (profiles ?? []).map((p) => p.id)
  const { data: authRows } = profileIds.length
    ? await admin.from('profiles_auth').select('id, email').in('id', profileIds)
    : { data: [] as { id: string; email: string | null }[] }
  const emailMap = new Map((authRows ?? []).map((r) => [r.id as string, r.email as string | null]))

  const profileMap = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, { nome: p.full_name as string, cargo: (p as Record<string, unknown>).cargo as string | null }])
  )
  const membros = (profiles ?? [])
    .filter((p) => emailMap.get(p.id))
    .map((p) => ({
      id:    p.id,
      nome:  profileMap[p.id]?.nome ?? emailMap.get(p.id)!.split('@')[0],
      cargo: profileMap[p.id]?.cargo ?? null,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  // Admin/sócio: todos os processos; outros: só os seus
  type ProcessoRespRow = {
    id: string
    numero_processo: string
    assunto: string | null
    area: string | null
    status: string
    advogado_id: string | null
    [key: string]: unknown
  }

  let processos: ProcessoRespRow[]
  try {
    processos = await fetchAllRows<ProcessoRespRow>((from, to) => {
      const q = supabase
        .from('processos_juridicos')
        .select(`
          id, numero_processo, assunto, area, status,
          advogado_id,
          profiles!advogado_id(id, full_name),
          clientes(razao_social)
        `)
        .order('status', { ascending: true })
        .order('numero_processo', { ascending: true })
        .range(from, to)
      return isAdmin ? q : q.eq('advogado_id', user.id)
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return <p className="p-8 text-sm text-destructive">{msg}</p>
  }

  const lista = processos.map((p) => {
    const advRaw   = p['profiles!advogado_id'] as { id: string; full_name: string } | null
    const clienteRaw = p['clientes'] as { razao_social: string } | null
    return {
      id:             p.id,
      numero:         p.numero_processo,
      assunto:        p.assunto,
      area:           p.area ? AREA_LABELS[areaToSlug(p.area)] ?? p.area : null,
      status:         p.status as string,
      advogadoId:     p.advogado_id as string | null,
      advogadoNome:   advRaw?.full_name ?? null,
      clienteNome:    clienteRaw?.razao_social ?? null,
    }
  })

  const semResponsavel = lista.filter((p) => !p.advogadoId).length

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
          <UserCheck className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Responsabilidades</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? 'Gerencie quem é responsável por cada processo.'
              : 'Processos sob sua responsabilidade.'}
          </p>
        </div>
      </div>

      {/* Alerta sem responsável (admin only) */}
      {isAdmin && semResponsavel > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-300">
          <Scale className="mt-0.5 size-4 shrink-0" />
          <p>
            <strong>{semResponsavel}</strong> processo{semResponsavel > 1 ? 's' : ''} sem
            responsável atribuído. Atribua abaixo para organizar o fluxo do escritório.
          </p>
        </div>
      )}

      {/* Tabela */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Processo</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Cliente</th>
              <th className="hidden px-4 py-3 text-left text-xs font-medium text-muted-foreground md:table-cell">Área</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Responsável</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lista.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {isAdmin
                    ? 'Nenhum processo cadastrado ainda.'
                    : 'Você não tem processos atribuídos no momento.'}
                </td>
              </tr>
            ) : (
              lista.map((p) => (
                <tr key={p.id} className="group transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link
                      href={`/processos/${p.id}`}
                      className="font-mono text-xs font-medium text-foreground underline-offset-2 hover:underline"
                    >
                      {p.numero}
                    </Link>
                    {p.assunto && (
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{p.assunto}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {p.clienteNome ?? <span className="italic text-muted-foreground">—</span>}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    {p.area
                      ? <span className="whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{p.area}</span>
                      : <span className="italic text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge variant={variantStatusProcesso(p.status)}>
                      {labelStatusProcesso(p.status)}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3">
                    <ReatribuirSelect
                      processoId={p.id}
                      advogadoId={p.advogadoId}
                      membros={membros}
                      readonly={!isAdmin}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {isAdmin && lista.length > 0 && (
          <div className="border-t border-border bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
            {lista.length} processo{lista.length !== 1 ? 's' : ''} no total
            {semResponsavel > 0 && ` · ${semResponsavel} sem responsável`}
          </div>
        )}
      </div>
    </div>
  )
}
