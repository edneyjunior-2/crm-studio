import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Termos de Uso — CRM Studio',
  description: 'Termos de Uso do CRM Studio.',
}

const SECOES = [
  {
    titulo: '1. Aceitação dos Termos',
    texto:
      '[texto jurídico em elaboração]',
  },
  {
    titulo: '2. Descrição do Serviço',
    texto:
      '[texto jurídico em elaboração]',
  },
  {
    titulo: '3. Cadastro e Conta',
    texto:
      '[texto jurídico em elaboração]',
  },
  {
    titulo: '4. Uso Aceitável',
    texto:
      '[texto jurídico em elaboração]',
  },
  {
    titulo: '5. Planos, Pagamento e Cancelamento',
    texto:
      '[texto jurídico em elaboração]',
  },
  {
    titulo: '6. Propriedade Intelectual',
    texto:
      '[texto jurídico em elaboração]',
  },
  {
    titulo: '7. Privacidade e Proteção de Dados (LGPD)',
    texto:
      '[texto jurídico em elaboração]',
  },
  {
    titulo: '8. Limitação de Responsabilidade',
    texto:
      '[texto jurídico em elaboração]',
  },
  {
    titulo: '9. Alterações nos Termos',
    texto:
      '[texto jurídico em elaboração]',
  },
  {
    titulo: '10. Foro e Lei Aplicável',
    texto:
      '[texto jurídico em elaboração]',
  },
]

export default function TermosPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 sm:px-8">
      {/* Header */}
      <div className="mb-12">
        <p className="mb-3 text-sm font-medium text-accent">Legal</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Termos de Uso
        </h1>
        <p className="mt-4 text-muted-foreground">
          Versão 1.0 — válida a partir de 2026-06-14.
          <br />
          <span className="text-sm italic">
            O texto jurídico completo está em elaboração e será publicado antes do lançamento oficial do produto.
          </span>
        </p>
      </div>

      {/* Seções */}
      <div className="flex flex-col gap-10">
        {SECOES.map((secao) => (
          <section key={secao.titulo}>
            <h2 className="mb-3 text-lg font-semibold text-foreground">{secao.titulo}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{secao.texto}</p>
          </section>
        ))}
      </div>

      {/* Footer nav */}
      <div className="mt-16 flex flex-col gap-3 border-t border-border pt-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>Dúvidas?{' '}
          <Link href="/contato" className="font-medium text-foreground underline-offset-4 hover:underline">
            Fale com a gente
          </Link>
        </span>
        <Link
          href="/contrato-operador"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Ver Contrato de Operador (DPA) →
        </Link>
      </div>
    </div>
  )
}
