import Link from 'next/link'
import { ArrowRight, Check, HardHat, Scale, Truck } from 'lucide-react'
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
    eyebrow: 'Estoque',
    title: 'Saldo que se atualiza sozinho a cada movimentação.',
    body: 'Cadastre produtos com estoque mínimo e custo médio, registre entradas e saídas, e deixe o sistema recalcular saldo e custo médio automaticamente. Um alerta visual avisa quando o produto está abaixo do mínimo, antes de faltar.',
    points: ['Saldo e custo médio recalculados a cada movimentação', 'Alerta de estoque abaixo do mínimo', 'Histórico completo de entradas e saídas'],
  },
  {
    eyebrow: 'Recursos Humanos',
    title: 'Ponto, ausências e documentos, sem planilha de RH.',
    body: 'Cadastre colaboradores, registre férias, atestados e faltas, e feche o ponto do mês com dedução automática por falta não justificada. Documentos como ASO e contrato ficam guardados com acesso controlado e log de quem abriu cada um.',
    points: ['Ponto eletrônico com fechamento mensal automático', 'Controle de férias, atestados e faltas', 'Documentos do colaborador com acesso auditado'],
  },
]

const VERTICAIS_TEASER = [
  {
    slug: 'advocacia',
    icon: Scale,
    title: 'Advocacia',
    desc: 'DataJud e DJEN sincronizam movimentações e publicações automaticamente, sem caçar nada em diário.',
  },
  {
    slug: 'engenharia',
    icon: HardHat,
    title: 'Engenharia e Obras',
    desc: 'Orçamento com catálogo SINAPI, medição por etapa e equipe alocada por obra.',
  },
  {
    slug: 'frete',
    icon: Truck,
    title: 'Frete e Logística',
    desc: 'Calculadora de piso mínimo ANTT, cadastro de motoristas e cotação que vira negócio no pipeline.',
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
        <div className="mx-auto max-w-[1180px] px-6 py-16 sm:px-8 lg:py-24">
          <Reveal>
            <p className="text-sm font-medium text-muted-foreground">Feito pra cada setor</p>
            <h2 className="mt-3 max-w-2xl text-[clamp(1.75rem,3.5vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.03em]">
              Sua área provavelmente já tem um módulo pronto.
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {VERTICAIS_TEASER.map((v, i) => {
              const Icon = v.icon
              return (
                <Reveal key={v.slug} delay={i * 0.06}>
                  <Link
                    href={`/produto/${v.slug}`}
                    className="group flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition-colors hover:border-foreground/20"
                  >
                    <div className="inline-flex size-10 items-center justify-center rounded-xl bg-secondary text-foreground">
                      <Icon className="size-5" strokeWidth={1.7} />
                    </div>
                    <h3 className="mt-4 font-heading text-lg font-semibold">{v.title}</h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{v.desc}</p>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent">
                      Ver página completa
                      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-[1180px] px-6 py-14 sm:px-8">
          <Reveal>
            <p className="text-[15px] text-muted-foreground">
              <span className="font-semibold text-foreground">Não viu a sua área aqui?</span>{' '}
              <Link
                href="/contato"
                className="text-accent underline underline-offset-2 hover:no-underline"
              >
                Fala com a gente
              </Link>{' '}
              — criamos um módulo sob medida pro seu tipo de negócio, dentro do mesmo sistema.
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
