-- Habilita pg_cron (extensão nativa do Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Job diário às 8h horário de Brasília (11h UTC)
-- Marca como 'atrasado' toda conta que está 'pendente' e já venceu
SELECT cron.schedule(
  'marcar-contas-atrasadas',
  '0 11 * * *',
  $$
  UPDATE contas_pagar
  SET status = 'atrasado'
  WHERE status = 'pendente'
    AND data_vencimento < CURRENT_DATE;
  $$
);
