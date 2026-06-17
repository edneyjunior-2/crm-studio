'use client'

import { motion, useReducedMotion, useInView } from 'motion/react'
import { useRef } from 'react'
import { UserPlus, GitMerge, BadgeDollarSign } from 'lucide-react'
import { EASE_OUT } from './motion'

const STEPS = [
  {
    n: '01',
    icon: UserPlus,
    title: 'Cadastre sua equipe',
    desc: 'Convide vendedores, defina territórios e perfis de acesso em minutos. Sem planilha de onboarding.',
  },
  {
    n: '02',
    icon: GitMerge,
    title: 'Monte seu funil',
    desc: 'Crie etapas do jeito que sua operação funciona. Arraste negócios, adicione atividades e acompanhe o SLA.',
  },
  {
    n: '03',
    icon: BadgeDollarSign,
    title: 'Venda e receba',
    desc: 'Quando o negócio fecha, a conta a receber e a comissão já aparecem no financeiro. Zero dupla entrada.',
  },
]

function ConnectorLine({ active }: { active: boolean }) {
  return (
    <div className="relative hidden h-px flex-1 lg:flex" aria-hidden="true">
      <div className="absolute inset-0 bg-border" />
      <motion.div
        className="absolute inset-0 origin-left bg-accent"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: active ? 1 : 0 }}
        transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.1 }}
      />
    </div>
  )
}

export function HowItWorks() {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section className="bg-secondary/40 border-t border-border">
      <div className="mx-auto max-w-[1180px] px-6 py-20 sm:px-8 lg:py-28">
        {/* Cabeçalho */}
        <motion.div
          className="mb-16 text-center"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
        >
          <h2 className="text-[clamp(1.9rem,4vw,3rem)] font-bold leading-[1.04] tracking-[-0.03em]">
            Três passos para estar no ar
          </h2>
          <p className="mx-auto mt-4 max-w-md text-lg leading-relaxed text-muted-foreground">
            Da conta criada à primeira venda registrada, menos de 30 minutos.
          </p>
        </motion.div>

        {/* Steps */}
        <div ref={ref} className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-0">
          {STEPS.map((step, i) => {
            const Icon = step.icon
            const isLast = i === STEPS.length - 1
            const stepInView = inView && !reduce

            return (
              <div key={step.n} className="flex flex-1 flex-col lg:flex-row lg:items-start">
                {/* Card do step */}
                <motion.div
                  className="flex flex-1 flex-col gap-5"
                  initial={reduce ? false : { opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.55, ease: EASE_OUT, delay: i * 0.12 }}
                >
                  <div className="flex items-center gap-4 lg:flex-col lg:items-start lg:gap-5">
                    {/* Círculo numerado com ícone */}
                    <div className="relative">
                      <motion.div
                        className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_4px_20px_rgba(20,35,58,0.22)]"
                        initial={reduce ? false : { scale: 0.7, opacity: 0 }}
                        whileInView={{ scale: 1, opacity: 1 }}
                        viewport={{ once: true, margin: '-40px' }}
                        transition={{
                          type: 'spring',
                          stiffness: 200,
                          damping: 18,
                          delay: i * 0.12 + 0.1,
                        }}
                      >
                        <Icon className="size-6" strokeWidth={1.8} />
                      </motion.div>
                      <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
                        {i + 1}
                      </span>
                    </div>

                    <div className="lg:hidden">
                      <h3 className="text-[17px] font-semibold">{step.title}</h3>
                    </div>
                  </div>

                  <div>
                    <h3 className="hidden text-[17px] font-semibold lg:block">{step.title}</h3>
                    <p className="mt-1.5 max-w-[22rem] text-[14.5px] leading-relaxed text-muted-foreground lg:mt-2">
                      {step.desc}
                    </p>
                  </div>
                </motion.div>

                {/* Linha conectora entre steps */}
                {!isLast && (
                  <div className="mx-6 mt-7 hidden lg:block">
                    <ConnectorLine active={stepInView} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
