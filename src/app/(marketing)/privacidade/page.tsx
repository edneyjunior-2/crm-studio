import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Política de Privacidade — CRM Studio',
  description: 'Política de Privacidade e Proteção de Dados (LGPD) do CRM Studio.',
}

const SECOES = [
  {
    titulo: '1. Quem somos (Controlador)',
    texto: '[texto jurídico em elaboração]',
  },
  {
    titulo: '2. Dados que coletamos',
    texto: '[texto jurídico em elaboração]',
  },
  {
    titulo: '3. Finalidade do tratamento',
    texto: '[texto jurídico em elaboração]',
  },
  {
    titulo: '4. Base legal (LGPD, art. 7º)',
    texto: '[texto jurídico em elaboração]',
  },
  {
    titulo: '5. Compartilhamento de dados',
    texto: '[texto jurídico em elaboração]',
  },
  {
    titulo: '6. Transferência internacional',
    texto: '[texto jurídico em elaboração]',
  },
  {
    titulo: '7. Segurança e retenção',
    texto: '[texto jurídico em elaboração]',
  },
  {
    titulo: '8. Direitos do titular (LGPD, art. 18)',
    texto:
      'Você tem direito a: confirmar a existência de tratamento, acessar seus dados, corrigir dados incompletos ou desatualizados, anonimizar/bloquear/eliminar dados desnecessários, portar seus dados (exportação self-service disponível em Configurações → Privacidade & Dados) e revogar o consentimento. [texto jurídico em elaboração]',
  },
  {
    titulo: '9. Encarregado (DPO)',
    texto:
      'O Encarregado pela Proteção de Dados de cada empresa-cliente é informado pelo próprio administrador na seção Configurações → Privacidade & Dados. Para solicitações envolvendo dados tratados pelo CRM Studio como operador, utilize o canal indicado no Contrato de Operador (DPA). [texto jurídico em elaboração]',
  },
  {
    titulo: '10. Alterações nesta Política',
    texto: '[texto jurídico em elaboração]',
  },
]

export default function PrivacidadePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 sm:px-8">
      {/* Header */}
      <div className="mb-12">
        <p className="mb-3 text-sm font-medium text-accent">Legal</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Política de Privacidade
        </h1>
        <p className="mt-4 text-muted-foreground">
          Versão 1.0 — válida a partir de 2026-06-15.
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
        <span>
          Dúvidas?{' '}
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
