import { test, expect } from '@playwright/test'
import { loginAs, TEST_EMAIL } from './fixtures'

test.describe('Autenticação', () => {
  test('login com credenciais válidas → redireciona para /dashboard', async ({ page }) => {
    await loginAs(page)
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('login com senha errada → exibe mensagem de erro', async ({ page }) => {
    await page.goto('/login')
    await page.locator('#email').fill(TEST_EMAIL)
    await page.locator('#password').fill('senhaerrada123')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await page.waitForURL(/\/login/, { timeout: 10_000 })
    // A action redireciona para /login?error=... com a mensagem na query string
    await expect(page).toHaveURL(/error=/)
  })

  test('logout via botão Sair → redireciona para /login', async ({ page }) => {
    await loginAs(page)
    await expect(page).toHaveURL(/\/dashboard/)

    // Submeter o form de logout via JS — bypassa qualquer overlay (driver.js, nextjs-portal)
    // que interceptaria um click normal no botão "Sair"
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button[type="submit"]'))
      const sair = buttons.find(b => b.textContent?.includes('Sair'))
      ;(sair?.closest('form') as HTMLFormElement | null)?.requestSubmit()
    })
    await page.waitForURL(/\/login/, { timeout: 10_000 })
    await expect(page).toHaveURL(/\/login/)
  })

  test('rota protegida sem login → redireciona para /login', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForURL(/\/login/, { timeout: 10_000 })
    await expect(page).toHaveURL(/\/login/)
  })
})
