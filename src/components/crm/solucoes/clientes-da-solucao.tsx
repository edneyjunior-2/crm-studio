import Link from 'next/link'
import { Users } from 'lucide-react'
import type { ClienteDaSolucao } from '@/lib/solucao-clientes'

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** Bloco lateral do detalhe da solução: clientes distintos com negócios nela, com contagem e valor. */
export function ClientesDaSolucao({ clientes }: { clientes: ClienteDaSolucao[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Clientes desta solução</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {clientes.length}
        </span>
      </div>

      {clientes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <Users className="size-8 text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground">Nenhum cliente vinculado.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {clientes.map((cliente) => {
            const contato = [cliente.contato_nome, cliente.contato_email, cliente.contato_telefone]
              .filter(Boolean)
              .join(' · ')
            return (
              <li
                key={cliente.cliente_id}
                className="flex flex-col gap-1 rounded-lg border border-border p-3"
              >
                <Link
                  href={`/clientes/${cliente.cliente_id}`}
                  className="text-sm font-medium text-foreground line-clamp-1 hover:underline"
                >
                  {cliente.razao_social}
                </Link>
                {contato && (
                  <span className="text-xs text-muted-foreground line-clamp-1">{contato}</span>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {cliente.numero_negocios} {cliente.numero_negocios === 1 ? 'negócio' : 'negócios'}
                  </span>
                  <span className="text-xs font-medium text-foreground">
                    {BRL.format(cliente.valor_total)}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
