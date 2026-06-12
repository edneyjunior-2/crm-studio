#!/usr/bin/env npx tsx

const BASE_URL = process.env.APP_URL ?? 'http://localhost:3000'

interface SmokeCheck {
  name: string
  url: string
  headers?: Record<string, string>
}

async function smokeTest() {
  console.log(`Smoke test em ${BASE_URL}\n`)

  const healthToken = process.env.HEALTH_CHECK_TOKEN

  const checks: SmokeCheck[] = [
    {
      name: 'Health check',
      url: '/api/health',
      headers: healthToken ? { 'x-health-token': healthToken } : undefined,
    },
  ]

  let failed = 0

  for (const check of checks) {
    try {
      const res = await fetch(`${BASE_URL}${check.url}`, {
        headers: check.headers,
      })
      const ok = res.ok ? 'OK' : 'FALHOU'
      if (!res.ok) failed++
      console.log(`[${ok}] ${check.name} — HTTP ${res.status}`)
      if (!res.ok) {
        const text = await res.text()
        console.log(`   Erro: ${text.slice(0, 200)}`)
      } else {
        const json = await res.json()
        console.log(`   Resposta: ${JSON.stringify(json, null, 2)}`)
      }
    } catch (e) {
      console.log(`[FALHOU] ${check.name} — ERRO: ${e}`)
      failed++
    }
  }

  console.log(`\n${failed === 0 ? 'Tudo ok!' : `${failed} check(s) falharam`}`)
  process.exit(failed > 0 ? 1 : 0)
}

smokeTest()
