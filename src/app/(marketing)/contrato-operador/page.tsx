import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Contrato de Operador (DPA) — CRM Studio',
  description: 'Contrato de Operador de Dados (Data Processing Agreement) do CRM Studio, em conformidade com a LGPD.',
}

const SECOES = [
  {
    titulo: '1. Definições',
    texto:
      '[texto jurídico em elaboração]',
  },
  {
    titulo: '2. Objeto',
    texto:
      '[texto jurídico em elaboração]',
  },
  {
    titulo: '3. Obrigações do Operador (CRM Studio)',
    texto:
      '[texto jurídico em elaboração]',
  },
  {
    titulo: '4. Obrigações do Controlador (Cliente)',
    texto:
      '[texto jurídico em elaboração]',
  },
  {
    titulo: '5. Sub-operadores e Transferência Internacional',
    texto:
      '[texto jurídico em elaboração]',
  },
  {
    titulo: '6. Medidas de Segurança',
    texto:
      '[texto jurídico em elaboração]',
  },
  {
    titulo: '7. Notificação de Incidentes',
    texto:
      '[texto jurídico em elaboração]',
  },
  {
    titulo: '8. Direitos dos Titulares',
    texto:
      '[texto jurídico em elaboração]',
  },
  {
    titulo: '9. Retenção e Exclusão de Dados',
    texto:
      '[texto jurídico em elaboração]',
  },
  {
    titulo: '10. Auditoria',
    texto:
      '[texto jurídico em elaboração]',
  },
  {
    titulo: '11. Vigência e Rescisão',
    texto:
      '[texto jurídico em elaboração]',
  },
  {
    titulo: '12. Lei Aplicável (LGPD — Lei nº 13.709/2018)',
    texto:
      '[texto jurídico em elaboração]',
  },
]

export default function ContratoOperadorPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 sm:px-8">
      {/* Header */}
      <div className="mb-12">
        <p className="mb-3 text-sm font-medium text-accent">Legal · LGPD</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Contrato de Operador de Dados
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">Data Processing Agreement (DPA)</p>
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
        {SECOES.filter((s) => s.texto !== '[texto jurídico em elaboração]').map((secao) => (
          <section key={secao.titulo}>
            <h2 className="mb-3 text-lg font-semibold text-foreground">{secao.titulo}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {secao.texto.replace(' [texto jurídico em elaboração]', '')}
            </p>
          </section>
        ))}
        {SECOES.every((s) => s.texto === '[texto jurídico em elaboração]') && (
          <p className="text-sm text-muted-foreground italic">
            As cláusulas detalhadas estarão disponíveis antes do lançamento oficial.
          </p>
        )}
      </div>

      {/* Footer nav */}
      <div className="mt-16 flex flex-col gap-3 border-t border-border pt-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>
          Dúvidas sobre privacidade?{' '}
          <Link href="/contato" className="font-medium text-foreground underline-offset-4 hover:underline">
            Fale com a gente
          </Link>
        </span>
        <Link
          href="/termos"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          ← Ver Termos de Uso
        </Link>
      </div>
    </div>
  )
}
