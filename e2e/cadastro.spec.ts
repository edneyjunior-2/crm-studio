import { test, expect } from '@playwright/test'

test.describe('Cadastro', () => {
  test('cadastro PJ completo → redireciona para /login?cadastro=ok', async ({ page }) => {
    const ts = Date.now()
    await page.goto('/cadastro')

    // Garantir que a aba PJ está ativa (default)
    const btnPJ = page.getByRole('button', { name: 'Pessoa Jurídica' })
    if (await btnPJ.isVisible()) await btnPJ.click()

    // 8 dígitos: passa na validação do servidor (!cnpj) mas não aciona o useEffect
    // que só dispara a busca automática quando o campo tem exatamente 14 dígitos
    await page.locator('#cnpj').fill('12345678')

    await page.locator('#razao_social').fill(`Empresa E2E Teste ${ts}`)
    await page.locator('#nome_responsavel').fill('Responsável Teste')
    await page.locator('#email').fill(`playwright+${ts}@example.com`)
    await page.locator('#senha').fill('senhaSegura123!')
    await page.locator('#aceite_termo').check()

    await page.getByRole('button', { name: 'Criar conta grátis' }).click()

    await page.waitForURL('**/login?cadastro=ok', { timeout: 15_000 })
    await expect(page).toHaveURL(/cadastro=ok/)
  })

  test('cadastro sem aceitar termos → não avança', async ({ page }) => {
    await page.goto('/cadastro')

    await page.locator('#razao_social').fill('Empresa Sem Aceite')
    await page.locator('#nome_responsavel').fill('Fulano')
    await page.locator('#email').fill(`semaceite+${Date.now()}@teste.crm`)
    await page.locator('#senha').fill('senhaSegura123!')
    // NÃO marca o checkbox

    await page.getByRole('button', { name: 'Criar conta grátis' }).click()

    // Permanece em /cadastro (server action retorna erro sem redirect)
    await expect(page).toHaveURL(/\/cadastro/)
  })

  test('cadastro com senha curta → não avança', async ({ page }) => {
    await page.goto('/cadastro')

    await page.locator('#razao_social').fill('Empresa Senha Curta')
    await page.locator('#nome_responsavel').fill('Fulano')
    await page.locator('#email').fill(`curtasenha+${Date.now()}@teste.crm`)
    await page.locator('#senha').fill('123')
    await page.locator('#aceite_termo').check()

    await page.getByRole('button', { name: 'Criar conta grátis' }).click()

    await expect(page).toHaveURL(/\/cadastro/)
  })
})
