'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { sendWelcomeEmail } from '@/lib/email'

export async function cadastrar(formData: FormData): Promise<{ error?: string }> {
  const tipoPessoa = formData.get('tipo_pessoa') as 'pj' | 'pf'
  const nomeResponsavel = (formData.get('nome_responsavel') as string)?.trim()
  const email = (formData.get('email') as string)?.trim()
  const senha = formData.get('senha') as string
  const aceiteTermo = formData.get('aceite_termo') === 'on'

  if (!nomeResponsavel || !email || !senha) {
    return { error: 'Preencha todos os campos obrigatórios.' }
  }

  if (!aceiteTermo) {
    return { error: 'É necessário aceitar os Termos de Uso e o Contrato de Operador para continuar.' }
  }

  if (senha.length < 8) {
    return { error: 'A senha deve ter pelo menos 8 caracteres.' }
  }

  let metadata: Record<string, string>

  // Data do aceite — sem toISOString para não usar UTC offset: usamos ISO string do Date
  const agora = new Date()
  const aceiteEm =
    `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}` +
    `T${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}:${String(agora.getSeconds()).padStart(2, '0')}`

  if (tipoPessoa === 'pj') {
    const cnpj = (formData.get('cnpj') as string)?.trim()
    const razaoSocial = (formData.get('razao_social') as string)?.trim()
    const nomeFantasia = (formData.get('nome_fantasia') as string)?.trim() ?? ''

    if (!cnpj || !razaoSocial) {
      return { error: 'CNPJ e Razão Social são obrigatórios para pessoa jurídica.' }
    }

    metadata = {
      tipo_pessoa: 'pj',
      empresa_nome: razaoSocial,
      cnpj,
      razao_social: razaoSocial,
      nome_fantasia: nomeFantasia,
      full_name: nomeResponsavel,
      aceite_termos_versao: '1.0',
      aceite_em: aceiteEm,
    }
  } else {
    const cpf = (formData.get('cpf') as string)?.trim()

    if (!cpf) {
      return { error: 'CPF é obrigatório para pessoa física.' }
    }

    metadata = {
      tipo_pessoa: 'pf',
      empresa_nome: nomeResponsavel,
      cpf,
      full_name: nomeResponsavel,
      aceite_termos_versao: '1.0',
      aceite_em: aceiteEm,
    }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: {
      data: metadata,
    },
  })

  if (error) {
    // Tratar erros conhecidos do Supabase Auth
    if (error.message.includes('already registered') || error.message.includes('User already registered')) {
      return { error: 'Este e-mail já está cadastrado. Faça login ou recupere sua senha.' }
    }
    if (error.message.includes('Password should be')) {
      return { error: 'A senha deve ter pelo menos 8 caracteres.' }
    }
    return { error: `Erro ao criar conta: ${error.message}` }
  }

  // sendWelcomeEmail swallows seus próprios erros — await seguro, não bloqueia se Resend falhar
  await sendWelcomeEmail({
    to: email,
    nome: nomeResponsavel,
    empresaNome: metadata.empresa_nome,
  })

  redirect('/login?cadastro=ok')
}
