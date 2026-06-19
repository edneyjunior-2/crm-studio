import { test as base, type Page } from '@playwright/test'

export const TEST_EMAIL = process.env.TEST_USER_EMAIL ?? ''
export const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? ''
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
export const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
export const TEST_EMPRESA_ID = process.env.TEST_EMPRESA_ID ?? ''

if (!TEST_EMAIL || !TEST_PASSWORD) {
  throw new Error(
    'TEST_USER_EMAIL e TEST_USER_PASSWORD são obrigatórios.\n' +
    'Crie um arquivo .env.test.local com essas variáveis.\n' +
    'Veja e2e/README.md para instruções.'
  )
}

if (TEST_EMPRESA_ID && (!SUPABASE_URL || !SUPABASE_SERVICE_KEY)) {
  throw new Error(
    'TEST_EMPRESA_ID está definido mas NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY estão ausentes.\n' +
    'Os testes de paywall não podem funcionar sem essas variáveis.'
  )
}

export async function loginAs(page: Page, email = TEST_EMAIL, password = TEST_PASSWORD) {
  await page.goto('/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL('**/dashboard', { timeout: 15_000 })
}

export async function setEmpresaStatus(empresaId: string, status: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/empresas?id=eq.${empresaId}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ status }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`setEmpresaStatus(${status}) falhou: HTTP ${res.status} — ${body}`)
  }
}

export { base as test }
