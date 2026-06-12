import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { google } from 'googleapis'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_PRIVATE_KEY ?? ''
  const calendarId = process.env.GOOGLE_CALENDAR_ID

  // Info de diagnóstico (sem expor a chave)
  const diag = {
    email_set: !!email,
    email_value: email ?? '(não definido)',
    key_set: !!rawKey,
    key_starts: rawKey.slice(0, 40),
    key_has_literal_n: rawKey.includes('\\n'),
    key_has_real_newline: rawKey.includes('\n'),
    calendar_id: calendarId ?? '(não definido)',
  }

  if (!email || !rawKey || !calendarId) {
    return NextResponse.json({ error: 'Variáveis não configuradas', diag })
  }

  const key = rawKey.replace(/\\n/g, '\n').replace(/^["']|["']$/g, '')

  // Processar a chave — mesma lógica do google-calendar.ts
  const keyProcessed = rawKey.replace(/\\n/g, '\n').replace(/^["']|["']$/g, '')

  const diagKey = {
    ...diag,
    key_after_replace_starts: keyProcessed.slice(0, 60),
    key_after_has_real_newline: keyProcessed.includes('\n'),
    key_looks_valid: keyProcessed.startsWith('-----BEGIN PRIVATE KEY-----'),
  }

  try {
    const auth = new google.auth.JWT({
      email,
      key: keyProcessed,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    })

    const cal = google.calendar({ version: 'v3', auth })

    // 1. Testa leitura
    const today = new Date()
    const timeMin = `${today.getFullYear()}-${(today.getMonth()+1).toString().padStart(2,'0')}-01T00:00:00-03:00`
    const readRes = await cal.events.list({ calendarId, timeMin, maxResults: 1, singleEvents: true })
    const events_found = readRes.data.items?.length ?? 0

    // 2. Testa escrita com evento temporário
    let write_ok = false
    let write_error = null
    let write_code = null
    try {
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const ds = `${tomorrow.getFullYear()}-${(tomorrow.getMonth()+1).toString().padStart(2,'0')}-${tomorrow.getDate().toString().padStart(2,'0')}`
      const inserted = await cal.events.insert({
        calendarId,
        conferenceDataVersion: 0,
        requestBody: {
          summary: '[CRM TEST - pode deletar]',
          start: { dateTime: `${ds}T10:00:00-03:00`, timeZone: 'America/Sao_Paulo' },
          end:   { dateTime: `${ds}T10:30:00-03:00`, timeZone: 'America/Sao_Paulo' },
        },
      })
      write_ok = true
      // Deleta imediatamente
      if (inserted.data.id) {
        await cal.events.delete({ calendarId, eventId: inserted.data.id })
      }
    } catch (we: unknown) {
      const e = we as { message?: string; code?: number }
      write_error = e.message
      write_code = e.code
    }

    // 3. Verifica ACL (permissões reais)
    let acl_role = null
    try {
      const acl = await cal.acl.list({ calendarId })
      const rule = acl.data.items?.find(r => r.scope?.value === email)
      acl_role = rule?.role ?? 'não encontrado na ACL'
    } catch { acl_role = 'sem acesso à ACL' }

    return NextResponse.json({
      read_ok: true,
      events_found,
      write_ok,
      write_error,
      write_code,
      acl_role,
      diag: diagKey,
    })
  } catch (err: unknown) {
    const e = err as { message?: string; code?: number; errors?: unknown }
    return NextResponse.json({
      ok: false,
      error_message: e.message,
      error_code: e.code,
      error_details: e.errors,
      diag: diagKey,
    }, { status: 200 })
  }
}
