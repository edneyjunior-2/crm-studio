-- Simplifica processos_juridicos.status: 5 valores → 3 (em_transito, suspenso, concluido).
-- Mapeamento: ativo→em_transito, encerrado→concluido, arquivado→concluido.
-- ORDEM IMPORTA: migrar dados ANTES de trocar o CHECK.

-- 1) Migração de dados (antes do novo CHECK)
UPDATE public.processos_juridicos SET status = 'em_transito' WHERE status = 'ativo';
UPDATE public.processos_juridicos SET status = 'concluido'   WHERE status IN ('encerrado', 'arquivado');

-- 2) Novo default (inserts do form de novo processo dependem do default do banco)
ALTER TABLE public.processos_juridicos ALTER COLUMN status SET DEFAULT 'em_transito';

-- 3) Novo CHECK com os 3 valores
ALTER TABLE public.processos_juridicos
  DROP CONSTRAINT IF EXISTS processos_juridicos_status_check;
ALTER TABLE public.processos_juridicos
  ADD CONSTRAINT processos_juridicos_status_check
  CHECK (status IN ('em_transito', 'suspenso', 'concluido'));

NOTIFY pgrst, 'reload schema';
