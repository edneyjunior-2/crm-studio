'use server'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { sendWelcomeEmail } from '@/lib/email'
import { rateLimit, clientIp } from '@/lib/rate-limit'

// Remove máscara (pontos, traços, barras) e retorna só os dígitos
function apenasDigitos(v: string): string {
  return v.replace(/\D/g, '')
}

function validarCPF(cpf: string): boolean {
  const d = apenasDigitos(cpf)
  if (d.length !== 11) return false
  // Rejeita sequências homogêneas (ex: 111.111.111-11)
  if (/^(\d)\1{10}$/.test(d)) return false
  // Primeiro dígito verificador
  let soma = 0
  for (let i = 0; i < 9; i++) soma += parseInt(d[i]) * (10 - i)
  let resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(d[9])) return false
  // Segundo dígito verificador
  soma = 0
  for (let i = 0; i < 10; i++) soma += parseInt(d[i]) * (11 - i)
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  return resto === parseInt(d[10])
}

function validarCNPJ(cnpj: string): boolean {
  const d = apenasDigitos(cnpj)
  if (d.length !== 14) return false
  if (/^(\d)\1{13}$/.test(d)) return false
  const calc = (peso: number[]) =>
    peso.reduce((acc, p, i) => acc + parseInt(d[i]) * p, 0)
  const mod = (n: number) => {
    const r = n % 11
    return r < 2 ? 0 : 11 - r
  }
  const d1 = mod(calc([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]))
  if (d1 !== parseInt(d[12])) return false
  const d2 = mod(calc([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]))
  return d2 === parseInt(d[13])
}

export async function cadastrar(formData: FormData): Promise<{ error?: string }> {
  // Anti-abuso: 5 cadastros/hora por IP
  const ip = clientIp(await headers())
  if (!(await rateLimit(`cadastro:${ip}`, 5, 3600))) {
    return { error: 'Muitas tentativas de cadastro. Aguarde alguns minutos e tente novamente.' }
  }

  const tipoPessoa = formData.get('tipo_pessoa') as 'pj' | 'pf'
  const nomeResponsavel = (formData.get('nome_responsavel') as string)?.trim()
  const email = (formData.get('email') as string)?.trim()
  const senha = formData.get('senha') as string
  const aceiteTermo = formData.get('aceite_termo') === 'on'

  if (!nomeResponsavel || !email || !senha) {
    return { error: 'Preencha todos os campos obrigatórios.' }
  }

  // Validação de formato de e-mail
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Informe um endereço de e-mail válido.' }
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

    if (!validarCNPJ(cnpj)) {
      return { error: 'CNPJ inválido. Verifique e tente novamente.' }
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

    if (!validarCPF(cpf)) {
      return { error: 'CPF inválido. Verifique e tente novamente.' }
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

  redirect('/cadastro/pagamento')
}
