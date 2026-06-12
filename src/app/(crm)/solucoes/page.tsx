import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { Plus, Package } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SolucoesGrid } from '@/components/crm/solucoes/solucoes-grid'
import { SolucaoForm } from '@/components/crm/solucoes/solucao-form'
import type { Solucao } from '@/types'

async function SolucoesContent({ isAdmin }: { isAdmin: boolean }) {
  const supabase = await createClient()

  const { data: solucoes, error } = await supabase
    .from('solucoes')
    .select('*')
    .order('nome', { ascending: true })

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 py-10 text-center">
        <p className="text-sm text-destructive">
          Erro ao carregar soluções. Tente novamente mais tarde.
        </p>
      </div>
    )
  }

  return (
    <SolucoesGrid
      solucoes={(solucoes ?? []) as Solucao[]}
      isAdmin={isAdmin}
    />
  )
}

function SolucoesSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-5 w-28 rounded-full" />
          <div className="flex gap-1 border-t border-border pt-3">
            <Skeleton className="h-7 flex-1 rounded-lg" />
            <Skeleton className="size-7 rounded-lg" />
            <Skeleton className="size-7 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default async function SolucoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground font-[family-name:var(--font-heading)]">Soluções</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Portfólio de soluções representadas pela empresa.
          </p>
        </div>
        {isAdmin && (
          <SolucaoForm
            trigger={
              <Button>
                <Plus className="size-4" />
                Nova Solução
              </Button>
            }
          />
        )}
      </div>

      <Suspense fallback={<SolucoesSkeleton />}>
        <SolucoesContent isAdmin={isAdmin} />
      </Suspense>
    </div>
  )
}
