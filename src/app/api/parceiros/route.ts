import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data, error } = await supabase
    .from('parceiros')
    .select('id, nome, empresa')
    .order('nome', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json() as {
    nome: string
    contato_email?: string
    contato_telefone?: string
    cliente_id?: string   // se fornecido, vincula parceiro ao cliente
  }

  if (!body.nome?.trim()) {
    return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
  }

  // Verifica se já existe parceiro com esse nome (evita duplicata)
  const { data: existing } = await supabase
    .from('parceiros')
    .select('id, nome')
    .ilike('nome', body.nome.trim())
    .limit(1)
    .maybeSingle()

  if (existing) {
    // Já existe — só vincula ao cliente se necessário
    if (body.cliente_id) {
      await supabase.from('clientes').update({ parceiro_id: existing.id }).eq('id', body.cliente_id)
    }
    return NextResponse.json({ ...existing, ja_existia: true })
  }

  const { data: parceiro, error } = await supabase
    .from('parceiros')
    .insert({
      nome: body.nome.trim(),
      contato_email:    body.contato_email?.trim() || null,
      contato_telefone: body.contato_telefone?.trim() || null,
    })
    .select('id, nome')
    .single()

  if (error || !parceiro) {
    return NextResponse.json({ error: error?.message ?? 'Falha ao criar' }, { status: 500 })
  }

  if (body.cliente_id) {
    await supabase.from('clientes').update({ parceiro_id: parceiro.id }).eq('id', body.cliente_id)
  }

  return NextResponse.json(parceiro, { status: 201 })
}
