import { test, expect } from '@playwright/test'
import { loginAs, setEmpresaStatus, TEST_EMPRESA_ID } from './fixtures'

test.describe('Paywall', () => {
  test.skip(!TEST_EMPRESA_ID, 'TEST_EMPRESA_ID não definido — configure .env.test.local')

  test.beforeEach(async ({ page }) => {
    await loginAs(page)
  })

  // Restaura sempre 'ativo' após cada teste — garante isolamento mesmo se o teste falhar
  test.afterEach(async () => {
    if (TEST_EMPRESA_ID) {
      await setEmpresaStatus(TEST_EMPRESA_ID, 'ativo')
    }
  })

  test('empresa suspenso → rota CRM redireciona para /assinatura', async ({ page }) => {
    await setEmpresaStatus(TEST_EMPRESA_ID, 'suspenso')

    await page.goto('/dashboard')
    await page.waitForURL(/\/assinatura/, { timeout: 10_000 })
    await expect(page).toHaveURL(/\/assinatura/)
  })

  test('empresa cancelada → rota CRM redireciona para /assinatura', async ({ page }) => {
    await setEmpresaStatus(TEST_EMPRESA_ID, 'cancelado')

    await page.goto('/clientes')
    await page.waitForURL(/\/assinatura/, { timeout: 10_000 })
    await expect(page).toHaveURL(/\/assinatura/)
  })

  test('empresa ativa → acessa dashboard normalmente', async ({ page }) => {
    // afterEach já garante 'ativo', mas tornamos explícito para clareza do teste
    await setEmpresaStatus(TEST_EMPRESA_ID, 'ativo')

    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/dashboard/)
  })
})
