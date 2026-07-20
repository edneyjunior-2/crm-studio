/**
 * Ping pra um serviço de heartbeat externo (healthchecks.io ou similar) —
 * prova que a PRÓPRIA VERCEL disparou este cron, independente do resultado da
 * sincronização (isso é o que cron_execucoes já cobre). No-op se a env var
 * não estiver configurada — o dono ainda não tem conta criada; o código já
 * fica pronto pra quando ele configurar.
 *
 * Nunca lança: até uma URL malformada na env var (erro síncrono do fetch) é
 * capturada aqui dentro, não só a rejeição assíncrona da promise — então
 * `await` nunca atrasa o cron por causa de um erro, só pelo tempo normal do
 * request.
 *
 * Por padrão, chamar SEM `await` no call site (fire-and-forget de verdade —
 * não trava o cron esperando um serviço externo). EXCEÇÃO: quando o próprio
 * cron lê de volta o status desse mesmo check via API do healthchecks.io na
 * mesma execução (caso do monitor-ejlabs, vigia de si mesmo) — aí precisa de
 * `await` pra garantir que o ping foi processado antes da leitura, senão vira
 * corrida (leitura chega antes do ping, mostra "atrasado" com o cron em dia).
 */
export function pingHealthcheck(envVarName: string): Promise<void> {
  const url = process.env[envVarName]
  if (!url) return Promise.resolve()
  try {
    return fetch(url).then(
      () => undefined,
      (e: unknown) => {
        console.error(`[healthcheck] falha ao pingar ${envVarName}:`, e)
      },
    )
  } catch (e) {
    console.error(`[healthcheck] falha síncrona ao pingar ${envVarName}:`, e)
    return Promise.resolve()
  }
}
