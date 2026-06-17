import { Plus, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ClientesTable } from '@/components/crm/clientes/clientes-table'
import { ClienteForm } from '@/components/crm/clientes/cliente-form'
import { ImportarClientesDialog } from '@/components/crm/importar-clientes-dialog'
import type { Cliente } from '@/types'
import { Suspense } from 'react'

async function ClientesContent() {
  const supabase = await createClient()

  const { data: clientes, error } = await supabase
    .from('clientes')
    .select('*')
    .order('razao_social', { ascending: true })

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 py-10 text-center">
        <p className="text-sm text-destructive">
          Erro ao carregar clientes. Tente novamente mais tarde.
        </p>
      </div>
    )
  }

  return (
    <ClientesTable clientes={(clientes ?? []) as Cliente[]} />
  )
}

function ClientesSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-64" />
      <div className="rounded-xl border border-border bg-card p-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border px-2 py-3 last:border-0">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default async function ClientesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground font-[family-name:var(--font-heading)]">Clientes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie os clientes da sua carteira.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportarClientesDialog
            trigger={
              <Button variant="outline">
                <Upload className="size-4" />
                Importar planilha
              </Button>
            }
          />
          <ClienteForm
            trigger={
              <Button>
                <Plus className="size-4" />
                Novo Cliente
              </Button>
            }
          />
        </div>
      </div>

      <Suspense fallback={<ClientesSkeleton />}>
        <ClientesContent />
      </Suspense>
    </div>
  )
}
