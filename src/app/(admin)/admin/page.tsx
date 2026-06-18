import { createAdminClient } from '@/lib/supabase/admin'

const STATUS_LABELS: Record<string, string> = {
  trial:     'Trial',
  ativo:     'Ativo',
  pendente:  'Pendente',
  atrasado:  'Atrasado',
  suspenso:  'Suspenso',
  cancelado: 'Cancelado',
}

const STATUS_COLORS: Record<string, string> = {
  trial:     'bg-blue-50 text-blue-700 border-blue-200',
  ativo:     'bg-green-50 text-green-700 border-green-200',
  pendente:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  atrasado:  'bg-orange-50 text-orange-700 border-orange-200',
  suspenso:  'bg-red-50 text-red-700 border-red-200',
  cancelado: 'bg-muted text-muted-foreground border-border',
}

export default async function AdminDashboardPage() {
  const db = createAdminClient()
  const { data: empresas } = await db
    .from('empresas')
    .select('status')

  const totals = Object.keys(STATUS_LABELS).reduce<Record<string, number>>((acc, s) => {
    acc[s] = (empresas ?? []).filter((e) => e.status === s).length
    return acc
  }, {})

  const total = (empresas ?? []).length

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {total} empresa{total !== 1 ? 's' : ''} cadastrada{total !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(STATUS_LABELS).map(([status, label]) => (
          <div
            key={status}
            className={`rounded-xl border px-5 py-4 ${STATUS_COLORS[status]}`}
          >
            <p className="text-sm font-medium">{label}</p>
            <p className="mt-1 text-3xl font-bold">{totals[status] ?? 0}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
