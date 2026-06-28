import Link from 'next/link'
import { Check } from 'lucide-react'
import { Reveal } from '@/components/marketing/motion'
import { ProductShowcase } from '@/components/marketing/product-showcase'

export const metadata = {
  title: 'Produto · CRM Studio',
  description:
    'Pipeline de vendas, financeiro nativo, clientes e calendário. Veja como o CRM Studio liga o funil ao caixa.',
}

const FEATURES = [
  {
    eyebrow: 'Pipeline',
    title: 'O funil que o time inteiro entende.',
    body: 'Arraste o negócio entre as etapas e veja o valor previsto somar na hora. Cada fase tem prazo, motivo de perda e taxa de conversão, então você sabe onde a venda trava antes de perder.',
    points: ['Etapas prontas, do contato ao fechamento', 'Previsão de receita por etapa', 'Histórico de perdas com motivo'],
  },
  {
    eyebrow: 'Financeiro',
    title: 'A venda fechada já entra no caixa.',
    body: 'Negócio ganho cria a conta a receber, calcula a comissão e atualiza a previsão de caixa. Contas a pagar, multi-moeda, parcelamento e fornecedores no mesmo lugar, sem exportar para planilha.',
    points: ['Contas a pagar e a receber', 'Comissões de vendedor e parceiro', 'Fluxo de caixa e multi-moeda'],
  },
  {
    eyebrow: 'Clientes e agenda',
    title: 'A carteira e a agenda da equipe, organizadas.',
    body: 'Cadastro com busca de CNPJ automática, carteira protegida por território e reuniões sincronizadas com o Google Calendar de cada vendedor. Todo mundo enxerga a mesma informação.',
    points: ['Busca de CNPJ automática', 'Carteira protegida por território', 'Calendário integrado ao Google'],
  },
  {
    eyebrow: 'Advocacia',
    title: 'O processo se atualiza sozinho.',
    body: 'A integração com o DataJud puxa as novas movimentações de cada processo e avisa o advogado responsável por e-mail. Os prazos avisam antes de vencer, as audiências viram evento no Google Calendar e os documentos ficam anexados ao processo. Honorários e custas viram lançamento no financeiro, sem digitar duas vezes.',
    points: ['Movimentações automáticas via DataJud', 'Prazos e audiências com alerta', 'Honorários e guias no financeiro'],
  },
  {
    eyebrow: 'Engenharia',
    title: 'Do orçamento à medição, sem planilha solta.',
    body: 'Monte o orçamento buscando composições e insumos direto no catálogo SINAPI, com BDI e desoneração, e gere o PDF para o cliente. Cada obra acompanha etapas, medições e a equipe alocada no mesmo lugar.',
    points: ['Orçamento com catálogo SINAPI, BDI e desoneração', 'Etapas e medições com avanço de status', 'Equipe por obra e ponto integrado'],
  },
]

export default function ProdutoPage() {
  return (
    <>
      <section className="mx-auto max-w-[1180px] px-6 pb-12 pt-16 sm:px-8 lg:pt-24">
        <Reveal>
          <p className="text-sm font-medium text-muted-foreground">Como funciona</p>
          <h1 className="mt-5 max-w-4xl text-balance text-[clamp(2.5rem,5.5vw,4.5rem)] font-bold leading-[0.98] tracking-[-0.04em]">
            Um sistema, do primeiro contato ao caixa.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            O CRM Studio foi construído para parar de copiar dados de uma ferramenta para outra. O que
            acontece no funil reflete na agenda e no financeiro, automaticamente.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="mt-12">
            <ProductShowcase defaultTab="financeiro" />
          </div>
        </Reveal>
      </section>

      {FEATURES.map((f, i) => (
        <section key={f.eyebrow} className="border-t border-border">
          <div className="mx-auto max-w-[1180px] px-6 py-16 sm:px-8 lg:py-24">
            <Reveal>
              <div className={`grid items-start gap-10 lg:grid-cols-2 lg:gap-20 ${i % 2 === 1 ? 'lg:[&>*:first-child]:order-2' : ''}`}>
                <div>
                  <p className="text-sm font-medium text-accent">{f.eyebrow}</p>
                  <h2 className="mt-3 text-[clamp(1.75rem,3.5vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.03em]">
                    {f.title}
                  </h2>
                  <p className="mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">{f.body}</p>
                </div>
                <ul className="flex flex-col gap-3 lg:pt-12">
                  {f.points.map((p) => (
                    <li key={p} className="flex items-center gap-3 border-b border-border pb-3 text-[15px]">
                      <Check className="size-4 shrink-0 text-accent" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </section>
      ))}

      <section className="border-t border-border">
        <div className="mx-auto max-w-[1180px] px-6 py-14 sm:px-8">
          <Reveal>
            <p className="text-[15px] text-muted-foreground">
              <span className="font-semibold text-foreground">Em breve:</span> módulos de Estoque e
              Recursos Humanos, ligados às mesmas vendas e ao mesmo financeiro.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-[1180px] flex-col items-start justify-between gap-6 px-6 py-16 sm:px-8 md:flex-row md:items-center">
          <h2 className="max-w-xl text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold leading-[1.05] tracking-[-0.03em]">
            Veja o CRM Studio com os seus números.
          </h2>
          <Link
            href="/contato"
            className="inline-flex shrink-0 items-center justify-center rounded-full bg-accent px-7 py-3.5 text-[15px] font-semibold text-accent-foreground transition-transform hover:-translate-y-0.5"
          >
            Agendar demo
          </Link>
        </div>
      </section>
    </>
  )
}
