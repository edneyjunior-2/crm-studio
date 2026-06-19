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

    // O botão "Sair" fica na sidebar (form action={logout})
    // force: true — o driver.js (tour de onboarding) pode sobrepor um overlay que intercepta o click
    await page.getByRole('button', { name: 'Sair' }).click({ force: true })
    await page.waitForURL(/\/login/, { timeout: 10_000 })
    await expect(page).toHaveURL(/\/login/)
  })

  test('rota protegida sem login → redireciona para /login', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForURL(/\/login/, { timeout: 10_000 })
    await expect(page).toHaveURL(/\/login/)
  })
})
