'use client'

import { motion, useReducedMotion } from 'motion/react'
import { EASE_OUT } from './motion'

const OBJECOES = [
  {
    q: 'Vou perder tudo o que já está na planilha?',
    a: 'Não. Você importa sua carteira de clientes direto da planilha (CSV) assim que entra no sistema — nada de digitar tudo de novo. Sua planilha original continua intacta enquanto você testa. Migrar leva minutos, não semanas.',
  },
  {
    q: 'Isso funciona pro tipo de negócio que eu tenho?',
    a: 'O núcleo — vendas, financeiro, contratos e clientes — serve pra qualquer empresa que vende e cobra. Em cima disso, você ativa módulos por setor: já existem versões prontas pra advocacia (processos, prazos) e engenharia (obras, orçamento SINAPI), e outras áreas com estoque, RH e mais. Você monta a combinação do seu negócio.',
  },
  {
    q: 'Quanto custa? Vai encarecer quando meu time crescer?',
    a: 'Preço fixo por empresa, a partir de R$ 147/mês — não por usuário. Coloque o time inteiro que a mensalidade não muda. Comece pelo teste grátis de 14 dias, sem cartão: se não fizer sentido, é só não continuar.',
    micro: 'Starter R$ 147 · Pro R$ 297 · Business R$ 497 — todos por empresa, não por usuário.',
  },
  {
    q: 'E a segurança dos meus dados e dos meus clientes?',
    a: 'Seus dados ficam isolados dos de qualquer outra empresa, criptografados e armazenados em infraestrutura de nuvem de padrão internacional. O CRM Studio é construído em conformidade com a LGPD, com controle de acesso por perfil — cada pessoa vê só o que precisa. Você exporta ou apaga seus dados quando quiser.',
  },
]

export function Objecoes() {
  const reduce = useReducedMotion()

  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-[1180px] px-6 py-20 sm:px-8 lg:py-28">
        {/* Cabeçalho */}
        <motion.div
          className="mb-14 max-w-2xl"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
        >
          <h2 className="text-[clamp(1.9rem,4vw,3rem)] font-bold leading-[1.04] tracking-[-0.03em]">
            Tá, mas e o meu caso?
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            As perguntas que todo mundo faz antes de largar a planilha.
          </p>
        </motion.div>

        {/* Grid de objeções */}
        <div className="grid gap-4 sm:grid-cols-2">
          {OBJECOES.map((o, i) => (
            <motion.div
              key={o.q}
              initial={reduce ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, ease: EASE_OUT, delay: i * 0.06 }}
              className="rounded-2xl border border-border bg-card p-6"
            >
              <span className="mb-3 inline-flex size-7 items-center justify-center rounded-full bg-secondary text-[12px] font-bold text-foreground">
                {i + 1}
              </span>
              <h3 className="text-[17px] font-semibold leading-snug">{o.q}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{o.a}</p>
              {o.micro && (
                <p className="mt-3 rounded-lg bg-secondary px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
                  {o.micro}
                </p>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
