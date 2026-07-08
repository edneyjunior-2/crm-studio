-- Simplifica processos_juridicos.status: 5 valores → 3 (em_transito, suspenso, concluido).
-- Mapeamento: ativo→em_transito, encerrado→concluido, arquivado→concluido.
-- ORDEM IMPORTA: o CHECK antigo (só 5 valores velhos) precisa sair ANTES do
-- UPDATE, senão a própria migração de dados viola a constraint que ela está
-- tentando substituir (bug corrigido em 2026-07-08 — a versão anterior deste
-- arquivo tentava migrar os dados primeiro e falhava na 1ª linha).

-- 1) Remove o CHECK antigo primeiro — sem ele a tabela fica sem trava
--    momentaneamente, mas é a mesma transação da migration inteira.
ALTER TABLE public.processos_juridicos
  DROP CONSTRAINT IF EXISTS processos_juridicos_status_check;

-- 2) Migração de dados, agora sem constraint pra travar os valores novos
UPDATE public.processos_juridicos SET status = 'em_transito' WHERE status = 'ativo';
UPDATE public.processos_juridicos SET status = 'concluido'   WHERE status IN ('encerrado', 'arquivado');

-- 3) Novo default (inserts do form de novo processo dependem do default do banco)
ALTER TABLE public.processos_juridicos ALTER COLUMN status SET DEFAULT 'em_transito';

-- 4) Novo CHECK com os 3 valores
ALTER TABLE public.processos_juridicos
  ADD CONSTRAINT processos_juridicos_status_check
  CHECK (status IN ('em_transito', 'suspenso', 'concluido'));

NOTIFY pgrst, 'reload schema';
