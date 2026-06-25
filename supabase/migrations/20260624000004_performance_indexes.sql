-- Índice parcial: movimentacoes_processo não lidas (badge de notificação)
CREATE INDEX IF NOT EXISTS idx_mov_processo_nao_lidas
  ON movimentacoes_processo(empresa_id, processo_id) WHERE lido = false;

-- Índices em followups para listagem e responsável
CREATE INDEX IF NOT EXISTS idx_followups_status_data
  ON followups(status, data_agendada);

CREATE INDEX IF NOT EXISTS idx_followups_responsavel_status
  ON followups(responsavel_id, status, data_agendada);
