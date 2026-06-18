import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Scale, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ProcessosFilter } from './processos-filter'

export default async function ProcessosPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: processos, error }, { data: naoLidos }, { data: advogados }] = await Promise.all([
    supabase
      .from('processos_juridicos')
      .select(`
        id,
        numero_processo,
        tribunal_slug,
        assunto,
        vara,
        status,
        ultimo_datajud_update,
        created_at,
        advogado_id,
        clientes(id, razao_social),
        profiles!advogado_id(id, full_name)
      `)
      .order('created_at', { ascending: false }),

    supabase
      .from('movimentacoes_processo')
      .select('processo_id')
      .eq('lido', false),

    supabase
      .from('profiles')
      .select('id, full_name')
      .order('full_name'),
  ])

  // Contagem de não lidos por processo
  const naoLidosPorProcesso = new Map<string, number>()
  for (const row of naoLidos ?? []) {
    naoLidosPorProcesso.set(
      row.processo_id,
      (naoLidosPorProcesso.get(row.processo_id) ?? 0) + 1,
    )
  }

  // Normaliza dados para o componente cliente
  const processosNorm = (processos ?? []).map((p) => {
    const clienteRaw = p.clientes as unknown
    const advRaw     = (p as Record<string, unknown>)['profiles!advogado_id'] as unknown
    return {
      id:             p.id,
      numeroProcesso: p.numero_processo,
      tribunalSlug:   p.tribunal_slug,
      status:         p.status,
      clienteNome:    (clienteRaw as { razao_social?: string } | null)?.razao_social ?? null,
      advogadoNome:   (advRaw as { full_name?: string } | null)?.full_name ?? null,
      advogadoId:     p.advogado_id as string | null,
      ultimoUpdate:   p.ultimo_datajud_update,
      assunto:        p.assunto,
      vara:           p.vara,
      qtdNaoLidos:    naoLidosPorProcesso.get(p.id) ?? 0,
    }
  })

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-tight text-foreground">
            Processos Jurídicos
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe todos os processos e receba atualizações automáticas via DataJud.
          </p>
        </div>
        <Link
          href="/processos/novo"
          className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
        >
          <Plus className="size-4" />
          Novo processo
        </Link>
      </div>

      {/* Erro */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          Erro ao carregar processos. Tente novamente.
        </div>
      )}

      {/* Estado vazio inicial (sem processos no banco) */}
      {!error && processosNorm.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border py-20 text-center">
          <Scale className="size-10 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-medium text-foreground">Nenhum processo cadastrado</p>
            <p className="mt-1 text-sm text-muted-foreground">Cadastre o primeiro processo do escritório.</p>
          </div>
          <Link
            href="/processos/novo"
            className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background"
          >
            <Plus className="size-4" />
            Cadastrar processo
          </Link>
        </div>
      )}

      {/* Filtros + grade (client-side, sem reload) */}
      {!error && processosNorm.length > 0 && (
        <ProcessosFilter
          processos={processosNorm}
          advogados={(advogados ?? []).map((a) => ({ id: a.id, full_name: a.full_name }))}
        />
      )}
    </div>
  )
}
