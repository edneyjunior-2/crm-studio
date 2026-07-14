'use server'

import { headers } from 'next/headers'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { sendWelcomeEmail } from '@/lib/email'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { planoValido } from '@/lib/planos'

export async function cadastrar(formData: FormData): Promise<{ error?: string }> {
  // Anti-abuso: 5 cadastros/hora por IP. FAIL-CLOSED de propósito — criamos o
  // usuário pela Admin API (ver abaixo), o que contorna o rate limit nativo do
  // signup público do Supabase. Este limiter é a ÚNICA barreira, e cada cadastro
  // dispara handle_new_user (auth.users + empresas + profiles). Se ele abrisse
  // na falha do banco, um atacante que satura o Postgres derrubaria justamente a
  // trava que deveria contê-lo.
  const ip = clientIp(await headers())
  if (!(await rateLimit(`cadastro:${ip}`, 5, 3600, { failClosed: true }))) {
    return { error: 'Muitas tentativas de cadastro. Aguarde alguns minutos e tente novamente.' }
  }

  const email = (formData.get('email') as string)?.trim()
  const aceiteTermo = formData.get('aceite_termo') === 'on'
  // Entrada do usuário (vem do formulário, originada de ?plano= no /precos) —
  // nunca confiar na string crua: whitelist no servidor (spec
  // planos-verticais-no-checkout.md). O preço em si nunca é lido daqui; sai
  // sempre de PRECO_POR_PLANO (ver cadastro/pagamento/actions.ts e o webhook).
  const plano = planoValido(formData.get('plano'))

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
    plano_contratado: plano,
  }

  // ponytail: senha aleatória forte só para satisfazer a API do Supabase Auth —
  // a pessoa nunca escolhe nem vê essa senha. Ela define a própria senha depois
  // (Parte C/D: /definir-senha com a sessão já ativa, ou o link do e-mail de
  // acesso liberado — ver spec onboarding-senha-pos-pagamento.md). NUNCA logar
  // nem devolver este valor em nenhuma resposta.
  const senhaGerada = randomBytes(24).toString('base64url')

  // Admin API (não signUp): com mailer_autoconfirm=false na instância, signUp()
  // cria o usuário mas NÃO devolve sessão (a pessoa precisaria clicar num link
  // de confirmação primeiro) — era isso que jogava todo mundo de volta pro
  // login depois do cadastro (ver spec fix-cadastro-sem-sessao.md). createUser
  // com email_confirm:true marca o e-mail como confirmado de forma
  // determinística, sem depender daquela chave de config do painel, e evita
  // que o Supabase mande o e-mail de confirmação dele (a pessoa já recebe o
  // nosso). É a API oficial — cria a identity corretamente; nunca inserir em
  // auth.users por SQL cru (identity sem provider_id/iss quebra a API admin
  // do GoTrue inteira).
  const admin = createAdminClient()
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password: senhaGerada,
    email_confirm: true,
    user_metadata: metadata,
  })

  if (createError) {
    // E-mail duplicado: a Admin API devolve code 'email_exists' (ou mensagem
    // "already been registered"), diferente do "User already registered" do
    // signUp público — cobrimos as duas formas para não quebrar se o texto mudar.
    if (
      createError.code === 'email_exists' ||
      /already (been )?registered|already exists/i.test(createError.message)
    ) {
      return { error: 'Este e-mail já está cadastrado. Faça login ou recupere sua senha.' }
    }
    console.error('[cadastrar] erro ao criar usuário:', createError.message)
    return { error: `Erro ao criar conta: ${createError.message}` }
  }

  // Estabelece a sessão (grava os cookies via client SSR) — sem isso,
  // /cadastro/pagamento não encontra usuário autenticado e cai no loop
  // silencioso pro /login. Fail-loud: só seguimos pro pagamento com sessão real.
  const supabase = await createClient()
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: senhaGerada,
  })

  if (signInError || !signInData.session) {
    console.error(
      '[cadastrar] conta criada mas sessão não foi estabelecida:',
      signInError?.message ?? 'sessão ausente na resposta'
    )
    // NÃO mandar pra tela de login: a senha desta conta é aleatória e a pessoa
    // nunca a viu — "faça login" seria uma porta trancada. O caminho aberto é
    // definir a senha por "Esqueci minha senha"; depois disso o gate do CRM já
    // a leva pro /cadastro/pagamento (status pendente_cartao).
    return {
      error: 'Sua conta foi criada, mas não conseguimos iniciar sua sessão. Acesse "Esqueci minha senha" com este e-mail para definir uma senha e continuar de onde parou.',
    }
  }

  // sendWelcomeEmail swallows seus próprios erros — await seguro, não bloqueia se Resend falhar
  await sendWelcomeEmail({
    to: email,
    nome: email,
    empresaNome: metadata.empresa_nome,
  })

  redirect('/cadastro/pagamento')
}
