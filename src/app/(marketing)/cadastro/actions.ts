'use server'

import { headers } from 'next/headers'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { sendWelcomeEmail } from '@/lib/email'
import { rateLimit, clientIp } from '@/lib/rate-limit'

export async function cadastrar(formData: FormData): Promise<{ error?: string }> {
  // Anti-abuso: 5 cadastros/hora por IP
  const ip = clientIp(await headers())
  if (!(await rateLimit(`cadastro:${ip}`, 5, 3600))) {
    return { error: 'Muitas tentativas de cadastro. Aguarde alguns minutos e tente novamente.' }
  }

  const email = (formData.get('email') as string)?.trim()
  const aceiteTermo = formData.get('aceite_termo') === 'on'

  if (!email) {
    return { error: 'Informe seu e-mail.' }
  }

  // Validação de formato de e-mail
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Informe um endereço de e-mail válido.' }
  }

  if (!aceiteTermo) {
    return { error: 'É necessário aceitar os Termos de Uso e o Contrato de Operador para continuar.' }
  }

  // Data do aceite — sem toISOString para não usar UTC offset: montamos a
  // string local manualmente (mesmo padrão do restante do projeto).
  const agora = new Date()
  const aceiteEm =
    `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}` +
    `T${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}:${String(agora.getSeconds()).padStart(2, '0')}`

  // empresa_nome/full_name recebem o e-mail como placeholder — nunca mostrado
  // pro usuário. handle_new_user() (ramo "fluxo fundador") só cria a empresa
  // quando empresa_nome vem preenchido; o nome real (nome/razão social/CNPJ/
  // CPF) é coletado depois na própria tela do Checkout Asaas e gravado pelo
  // webhook em SUBSCRIPTION_CREATED (ver src/app/api/asaas/webhook/route.ts).
  const metadata = {
    empresa_nome: email,
    full_name: email,
    aceite_termos_versao: '1.0',
    aceite_em: aceiteEm,
  }

  const supabase = await createClient()

  // ponytail: senha aleatória forte só para satisfazer a API do Supabase Auth —
  // a pessoa nunca escolhe nem vê essa senha. Ela define a própria senha depois
  // (Parte C/D: /definir-senha com a sessão já ativa, ou o link do e-mail de
  // acesso liberado — ver spec onboarding-senha-pos-pagamento.md). NUNCA logar
  // nem devolver este valor em nenhuma resposta.
  const senhaGerada = randomBytes(24).toString('base64url')

  const { error } = await supabase.auth.signUp({
    email,
    password: senhaGerada,
    options: {
      data: metadata,
    },
  })

  if (error) {
    // Tratar erros conhecidos do Supabase Auth
    if (error.message.includes('already registered') || error.message.includes('User already registered')) {
      return { error: 'Este e-mail já está cadastrado. Faça login ou recupere sua senha.' }
    }
    return { error: `Erro ao criar conta: ${error.message}` }
  }

  // sendWelcomeEmail swallows seus próprios erros — await seguro, não bloqueia se Resend falhar
  await sendWelcomeEmail({
    to: email,
    nome: email,
    empresaNome: metadata.empresa_nome,
  })

  redirect('/cadastro/pagamento')
}
