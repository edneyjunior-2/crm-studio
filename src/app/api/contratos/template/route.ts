import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

// Serve o template de contrato do tenant via proxy (em vez de signed URL direta):
// o Supabase Storage serve .html como text/plain por padrão (proteção anti-XSS
// contra upload de HTML arbitrário), então o navegador mostrava o código-fonte
// em vez de renderizar. Aqui buscamos os bytes no servidor e devolvemos com o
// Content-Type correto — same-origin e auth-gated, sem depender de token na URL.
export async function GET() {
  const { empresaId } = await getAuthUser()
  if (!empresaId) {
    return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 400 })
  }

  const db = createAdminClient()
  const { data: empresa } = await db
    .from('empresas')
    .select('config')
    .eq('id', empresaId)
    .single()

  const config = (empresa?.config as Record<string, unknown> | null) ?? {}
  const templatePath = config.contrato_template_path as string | undefined
  const aprovado = config.contrato_aprovado as boolean | undefined

  if (!templatePath || !aprovado) {
    return NextResponse.json({ error: 'Modelo de contrato não disponível.' }, { status: 404 })
  }

  const { data, error } = await db.storage.from('contrato-templates').download(templatePath)
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Modelo não encontrado.' }, { status: 404 })
  }

  return new NextResponse(await data.text(), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
    },
  })
}
