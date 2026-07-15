// Verificacao manual do AC7 (projeto nao tem suite de teste unitario para
// src/lib/). Reproduz FIELMENTE a logica de processarResultado() alterada em
// src/lib/datajud-sync.ts -- mesma sequencia de decisoes, mesmo upsert com
// ON CONFLICT DO NOTHING -- contra uma tabela fake em memoria. Nao toca em
// producao.

type MovRow = {
  processo_id: string
  codigo_movimento: number
  data_movimentacao: string
  lido: boolean
}

const tabela: MovRow[] = []

function upsertIgnoreDuplicates(rows: MovRow[]): MovRow[] {
  const inseridas: MovRow[] = []
  for (const r of rows) {
    const existe = tabela.some(
      (t) => t.processo_id === r.processo_id && t.codigo_movimento === r.codigo_movimento && t.data_movimentacao === r.data_movimentacao,
    )
    if (!existe) {
      tabela.push(r)
      inseridas.push(r)
    }
  }
  return inseridas
}

// Replica exata da regra alterada em processarResultado():
//   const primeiraSincronizacao = processo.ultimo_datajud_update === null
//   ... lido: primeiraSincronizacao ...
//   ... if (qtdNovas > 0 && advogado_id && !primeiraSincronizacao) notifica ...
function processarSync(ultimoDatajudUpdate: string | null, movimentos: { codigo: number; data: string }[]) {
  const primeiraSincronizacao = ultimoDatajudUpdate === null
  const movs: MovRow[] = movimentos.map((m) => ({
    processo_id: 'P1',
    codigo_movimento: m.codigo,
    data_movimentacao: m.data,
    lido: primeiraSincronizacao,
  }))
  const inseridas = upsertIgnoreDuplicates(movs)
  const qtdNovas = inseridas.length
  const notificou = qtdNovas > 0 && !primeiraSincronizacao
  return { primeiraSincronizacao, qtdNovas, notificou }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error('FALHOU: ' + msg)
  console.log('OK:', msg)
}

const r1 = processarSync(null, [
  { codigo: 11, data: '2024-01-10' },
  { codigo: 60, data: '2024-03-05' },
  { codigo: 85, data: '2025-06-01' },
])
assert(r1.primeiraSincronizacao === true, 'sync 1 e reconhecida como backfill')
assert(r1.qtdNovas === 3, 'sync 1 insere as 3 movimentacoes historicas')
assert(r1.notificou === false, 'sync 1 (backfill) NAO dispara notificacao - AC4')
assert(tabela.every((t) => t.lido === true), 'sync 1: todas as 3 linhas ficam lido=true - AC2')

const r2 = processarSync('2026-07-15T10:00:00Z', [
  { codigo: 11, data: '2024-01-10' },
  { codigo: 60, data: '2024-03-05' },
  { codigo: 85, data: '2025-06-01' },
  { codigo: 22, data: '2026-07-15' },
])
assert(r2.primeiraSincronizacao === false, 'sync 2 nao e backfill')
assert(r2.qtdNovas === 1, 'sync 2 insere so a movimentacao genuinamente nova - AC3')
assert(r2.notificou === true, 'sync 2 dispara notificacao (advogado_id presente) - comportamento atual preservado')

const novaLinha = tabela.find((t) => t.codigo_movimento === 22)!
assert(novaLinha.lido === false, 'a movimentacao nova da sync 2 fica lido=false - AC3')

const linhasAntigas = tabela.filter((t) => t.codigo_movimento !== 22)
assert(linhasAntigas.every((t) => t.lido === true), 'as 3 linhas do backfill continuam lido=true (upsert nao as toca)')

console.log('\nTabela final:', tabela)
console.log('\nTodas as assercoes passaram.')
