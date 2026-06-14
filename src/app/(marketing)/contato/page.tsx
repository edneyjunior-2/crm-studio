import { Mail, CalendarClock, MessagesSquare } from 'lucide-react'
import { Reveal } from '@/components/marketing/motion'
import { ContatoForm } from '@/components/marketing/contato-form'

export const metadata = {
  title: 'Contato · CRM Studio',
  description: 'Agende uma demonstração ou fale com o time de vendas do CRM Studio.',
}

const CANAIS = [
  { Icon: CalendarClock, title: 'Agende uma demo', desc: 'Veja o CRM Studio rodando com os números da sua operação, em 30 minutos.' },
  { Icon: MessagesSquare, title: 'Fale com vendas', desc: 'Tire dúvidas de plano, migração e implantação com alguém do time.' },
  { Icon: Mail, title: 'Resposta rápida', desc: 'Respondemos em até um dia útil. Sem fila de robô.' },
]

export default function ContatoPage() {
  return (
    <section className="mx-auto max-w-[1180px] px-6 py-16 sm:px-8 lg:py-24">
      <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <div>
          <Reveal>
            <h1 className="max-w-md text-balance text-[clamp(2.25rem,5vw,4rem)] font-bold leading-[0.98] tracking-[-0.04em]">
              Vamos colocar seu comercial em ordem.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
              Conte um pouco sobre o seu time. A gente mostra como o CRM Studio resolve, sem enrolação.
            </p>
          </Reveal>

          <div className="mt-12 flex flex-col gap-6">
            {CANAIS.map((c, i) => (
              <Reveal key={c.title} delay={i * 0.06}>
                <div className="flex items-start gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-foreground">
                    <c.Icon className="size-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold">{c.title}</h2>
                    <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">{c.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal delay={0.1}>
          <ContatoForm />
        </Reveal>
      </div>
    </section>
  )
}
