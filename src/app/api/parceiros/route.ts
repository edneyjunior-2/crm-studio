import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'

export async function GET() {
  const auth = await getAuthUser()
  const supabase = auth.supabase

  const { data, error } = await supabase
    .from('parceiros')
    .select('id, nome, empresa')
    .order('nome', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser()
  const supabase = auth.supabase
  const empresaId = auth.empresaId
  if (!empresaId) return NextResponse.json({ error: 'Empresa não identificada' }, { status: 403 })

  const body = await req.json() as {
    nome: string
    contato_email?: string
    contato_telefone?: string
    cliente_id?: string   // se fornecido, vincula parceiro ao cliente
  }

  if (!body.nome?.trim()) {
    return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
  }

  // Verifica se já existe parceiro com esse nome NESTA empresa (evita duplicata cross-tenant)
  const { data: existing } = await supabase
    .from('parceiros')
    .select('id, nome')
    .eq('empresa_id', empresaId)
    .ilike('nome', body.nome.trim())
    .limit(1)
    .maybeSingle()

  if (existing) {
    // Já existe — só vincula ao cliente se necessário
    if (body.cliente_id) {
      const { error: vinculoError } = await supabase
        .from('clientes')
        .update({ parceiro_id: existing.id })
        .eq('id', body.cliente_id)
      if (vinculoError) {
        return NextResponse.json({ error: vinculoError.message }, { status: 500 })
      }
    }
    return NextResponse.json({ ...existing, ja_existia: true })
  }

  const { data: parceiro, error } = await supabase
    .from('parceiros')
    .insert({
      empresa_id:       empresaId,
      nome:             body.nome.trim(),
      contato_email:    body.contato_email?.trim() || null,
      contato_telefone: body.contato_telefone?.trim() || null,
    })
    .select('id, nome')
    .single()

  if (error || !parceiro) {
    return NextResponse.json({ error: error?.message ?? 'Falha ao criar' }, { status: 500 })
  }

  if (body.cliente_id) {
    const { error: vinculoError } = await supabase
      .from('clientes')
      .update({ parceiro_id: parceiro.id })
      .eq('id', body.cliente_id)
    if (vinculoError) {
      return NextResponse.json({ error: vinculoError.message }, { status: 500 })
    }
  }

  return NextResponse.json(parceiro, { status: 201 })
}
