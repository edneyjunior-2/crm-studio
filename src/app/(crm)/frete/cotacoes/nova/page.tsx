import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { NovaCotacaoForm } from './nova-cotacao-form'

export default async function NovaCotacaoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: clientes }, { data: veiculos }, { data: motoristas }] = await Promise.all([
    supabase.from('clientes').select('id, razao_social').order('razao_social'),
    supabase.from('frete_veiculos').select('id, placa').eq('ativo', true).order('placa'),
    supabase.from('frete_motoristas').select('id, nome').eq('ativo', true).order('nome'),
  ])

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/frete/cotacoes"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Cotações
      </Link>

      <div>
        <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-tight text-foreground">
          Nova cotação
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          O piso mínimo ANTT é calculado automaticamente ao salvar.
        </p>
      </div>

      <NovaCotacaoForm
        clientes={(clientes ?? []).map((c) => ({ id: c.id, razao_social: c.razao_social }))}
        veiculos={(veiculos ?? []).map((v) => ({ id: v.id, placa: v.placa }))}
        motoristas={(motoristas ?? []).map((m) => ({ id: m.id, nome: m.nome }))}
      />
    </div>
  )
}
