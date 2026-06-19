import { test, expect } from '@playwright/test'
import { loginAs } from './fixtures'

test.describe('Clientes', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page)
    await page.goto('/clientes')
    // Aguardar UI estar pronta (evita networkidle que pode travar com Supabase Realtime/WebSocket)
    await expect(page.getByRole('button', { name: /Novo Cliente/i })).toBeVisible({ timeout: 10_000 })
  })

  test('página de clientes carrega corretamente', async ({ page }) => {
    await expect(page).toHaveURL(/\/clientes/)
    await expect(page.getByRole('button', { name: /Novo Cliente/i })).toBeVisible()
  })

  test('criar novo cliente → aparece na lista', async ({ page }) => {
    const nomeCliente = `Cliente E2E ${Date.now()}`

    await page.getByRole('button', { name: /Novo Cliente/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })

    // razão social é o único campo obrigatório
    await page.locator('#razao_social').fill(nomeCliente)

    await page.getByRole('button', { name: /Cadastrar cliente/i }).click()

    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(nomeCliente)).toBeVisible({ timeout: 5_000 })
  })

  test('cancelar dialog → não cria cliente', async ({ page }) => {
    const nomeCancelado = `Cliente Cancelado ${Date.now()}`

    await page.getByRole('button', { name: /Novo Cliente/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    await page.locator('#razao_social').fill(nomeCancelado)
    await page.getByRole('button', { name: /Cancelar/i }).click()

    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 })
    // Nome único por timestamp — não pode existir na lista
    await expect(page.getByText(nomeCancelado)).not.toBeVisible()
  })
})
