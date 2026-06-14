// Teste end-to-end do fluxo do CRM Studio. Roda com:
//   node --env-file=.env.local scripts/test-fluxo-completo.mjs
// Cobre: isolamento de Storage do RH (dado sensível), cadastro PJ, campos novos
// do Onboarding, e CRUD do core (cliente/pipeline/financeiro) sob RLS. Limpa tudo.
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(url, svc, { auth: { persistSession: false, autoRefreshToken: false } })

const PW = 'Teste-Fluxo-9x7!'
let fails = 0
const ok = (m) => console.log('  ✅', m)
const bad = (m) => { console.log('  ❌', m); fails++ }
const cleanup = []

async function novoTenant(nome, meta = {}) {
  const email = `${nome.toLowerCase().replace(/\W+/g, '-')}-${Date.now()}@fluxo-test.local`
  const { data: list } = await admin.auth.admin.listUsers()
  const ja = list?.users?.find((u) => u.email === email)
  if (ja) await admin.auth.admin.deleteUser(ja.id)
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PW, email_confirm: true,
    user_metadata: { empresa_nome: nome, full_name: `Admin ${nome}`, ...meta },
  })
  if (error) throw new Error(`createUser ${email}: ${error.message}`)
  const { data: prof } = await admin.from('profiles').select('empresa_id').eq('id', data.user.id).single()
  cleanup.push(async () => {
    await admin.from('empresas').delete().eq('id', prof.empresa_id)
    await admin.auth.admin.deleteUser(data.user.id)
  })
  const sess = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
  await sess.auth.signInWithPassword({ email, password: PW })
  return { userId: data.user.id, empresaId: prof.empresa_id, email, sess }
}

async function main() {
  console.log('=== 1) RH — isolamento de Storage entre empresas (dado sensível) ===')
  const A = await novoTenant('Empresa Fluxo A')
  const B = await novoTenant('Empresa Fluxo B')
  // A cria um colaborador e faz upload de um documento
  const { data: colab, error: ce } = await A.sess.from('colaboradores')
    .insert({ nome: 'João da Silva', cargo: 'Analista', status: 'ativo' }).select('id').single()
  if (ce) bad(`A não criou colaborador: ${ce.message}`); else ok('A criou colaborador')
  const pathA = `${A.empresaId}/${colab?.id}/teste-aso.pdf`
  const up = await A.sess.storage.from('rh-documentos').upload(pathA, Buffer.from('conteudo ASO confidencial'), { contentType: 'application/pdf' })
  if (up.error) bad(`A não conseguiu upload no bucket: ${up.error.message}`); else ok('A fez upload do documento no bucket (path da própria empresa)')
  // A consegue baixar (signed URL)
  const signedA = await A.sess.storage.from('rh-documentos').createSignedUrl(pathA, 60)
  if (signedA.error) bad(`A não gerou signed URL do próprio doc: ${signedA.error.message}`); else ok('A gerou URL assinada do próprio documento')
  // B tenta acessar o documento de A pelo path → deve ser NEGADO
  const stealDownload = await B.sess.storage.from('rh-documentos').download(pathA)
  if (stealDownload.data) bad('VAZAMENTO: B baixou o documento de A!')
  else ok('B NÃO consegue baixar o documento de A (Storage RLS)')
  const stealSigned = await B.sess.storage.from('rh-documentos').createSignedUrl(pathA, 60)
  if (stealSigned.data?.signedUrl) bad('VAZAMENTO: B gerou signed URL do doc de A!')
  else ok('B NÃO gera URL assinada do documento de A')
  // B lista colaborador_documentos → não vê os de A (RLS de tabela)
  if (up.data) {
    await A.sess.from('colaborador_documentos').insert({ colaborador_id: colab.id, tipo: 'aso', nome_original: 'teste-aso.pdf', storage_path: pathA, sensivel: true })
    const { data: vistosB } = await B.sess.from('colaborador_documentos').select('id')
    if ((vistosB ?? []).length > 0) bad('VAZAMENTO: B vê registros de documentos de A na tabela')
    else ok('B NÃO vê os registros de documentos de A (tenant_isolation)')
  }

  console.log('\n=== 2) Cadastro PJ ponta a ponta (signUp → empresa com CNPJ/razão/aceite) ===')
  const emailPJ = `cadastro.pj.${Date.now()}@gmail.com`
  const exist = (await admin.auth.admin.listUsers()).data?.users?.find((u) => u.email === emailPJ)
  if (exist) await admin.auth.admin.deleteUser(exist.id)
  // Usa admin.createUser (mesmo trigger handle_new_user do signUp público) para evitar o
  // rate limit de e-mail do signUp ao rodar o teste várias vezes.
  const su = await admin.auth.admin.createUser({ email: emailPJ, password: PW, email_confirm: true, user_metadata: {
    tipo_pessoa: 'pj', empresa_nome: 'Comércio Boa Vista LTDA', cnpj: '12.345.678/0001-90',
    razao_social: 'Comércio Boa Vista LTDA', nome_fantasia: 'Boa Vista', full_name: 'Maria Gestora',
    aceite_termos_versao: '1.0', aceite_em: '2026-06-14T10:00:00',
  } })
  if (su.error) bad(`signUp PJ falhou: ${su.error.message}`)
  else {
    const uid = su.data.user.id
    cleanup.push(async () => {
      const { data: p } = await admin.from('profiles').select('empresa_id').eq('id', uid).single()
      if (p?.empresa_id) await admin.from('empresas').delete().eq('id', p.empresa_id)
      await admin.auth.admin.deleteUser(uid)
    })
    const { data: p } = await admin.from('profiles').select('empresa_id').eq('id', uid).single()
    const { data: emp } = await admin.from('empresas').select('nome, cnpj, razao_social, tipo_pessoa, aceite_termos_versao, aceite_termos_em').eq('id', p.empresa_id).single()
    if (emp?.cnpj === '12.345.678/0001-90' && emp?.tipo_pessoa === 'pj' && emp?.razao_social && emp?.aceite_termos_versao === '1.0' && emp?.aceite_termos_em) {
      ok(`empresa PJ criada com CNPJ/razão/tipo/aceite (${emp.nome})`)
    } else bad(`empresa PJ sem os campos do cadastro: ${JSON.stringify(emp)}`)
  }

  console.log('\n=== 3) Onboarding — card com cliente, prazo e concluído ===')
  const { data: cli } = await A.sess.from('clientes').insert({ razao_social: 'Cliente Onboarding' }).select('id').single()
  const { data: flx } = await A.sess.from('fluxos').insert({ titulo: 'Onboarding teste', visibilidade: 'privado', owner_id: A.userId }).select('id').single()
  const { data: col } = await A.sess.from('fluxo_colunas').insert({ fluxo_id: flx?.id, titulo: 'Boas-vindas', ordem: 0, cor: '#3B82F6' }).select('id').single()
  const card = await A.sess.from('fluxo_cards').insert({ fluxo_id: flx?.id, coluna_id: col?.id, titulo: 'Onboarding do cliente', cliente_id: cli?.id, data_limite: '2026-06-30', concluido: false }).select('id, cliente_id, data_limite, concluido').single()
  if (card.error) bad(`card de onboarding com campos novos falhou: ${card.error.message}`)
  else if (card.data.cliente_id === cli?.id && card.data.data_limite === '2026-06-30' && card.data.concluido === false) ok('card de onboarding gravou cliente_id + data_limite + concluido')
  else bad(`card de onboarding com valores errados: ${JSON.stringify(card.data)}`)

  console.log('\n=== 4) Core CRUD (cliente / pipeline / financeiro) sob RLS ===')
  const c2 = await A.sess.from('clientes').insert({ razao_social: 'Cliente Core' }).select('id, empresa_id').single()
  if (c2.error) bad(`cliente: ${c2.error.message}`); else ok(`cliente criado (empresa ${c2.data.empresa_id?.slice(0,8)})`)
  const sol = await A.sess.from('solucoes').insert({ nome: 'Solução teste', empresa_representada: 'Fornecedor X', comissao_percentual: 10, ativo: true }).select('id').single()
  const neg = await A.sess.from('negocios').insert({ titulo: 'Negócio teste', estagio: 'prospeccao', valor_estimado: 5000, cliente_id: c2.data?.id, solucao_id: sol.data?.id, responsavel_id: A.userId }).select('id').single()
  if (neg.error) bad(`negócio (pipeline): ${neg.error.message}`); else ok('negócio criado no pipeline')
  const cr = await A.sess.from('contas_receber').insert({ descricao: 'Mensalidade teste', valor: 1500, data_vencimento: '2026-06-30', status: 'pendente' }).select('id').single()
  if (cr.error) bad(`conta a receber (financeiro): ${cr.error.message}`); else ok('conta a receber criada no financeiro')
  // B não vê os dados de A
  const { data: clientesB } = await B.sess.from('clientes').select('razao_social')
  if ((clientesB ?? []).some((c) => c.razao_social?.includes('Cliente Core'))) bad('VAZAMENTO: B vê clientes de A')
  else ok('B não vê os clientes de A (isolamento no core)')

  console.log('\n=== Cleanup ===')
  // remover o doc do storage
  try { await admin.storage.from('rh-documentos').remove([pathA]) } catch {}
  for (const fn of cleanup.reverse()) { try { await fn() } catch {} }
  ok('dados de teste removidos')

  console.log(`\n${fails === 0 ? '✅ FLUXO COMPLETO OK — tudo passou' : `❌ ${fails} FALHA(S)`}`)
  process.exit(fails === 0 ? 0 : 1)
}

main().catch((e) => { console.error('ERRO no teste:', e.message); process.exit(1) })
