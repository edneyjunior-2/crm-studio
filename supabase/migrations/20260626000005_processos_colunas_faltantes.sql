-- =============================================================================
-- Fix: colunas usadas pelo importador de Excel e pelo detalhe do processo que
-- nunca foram criadas em processos_juridicos (schema-drift).
-- Sem elas, o INSERT do importador (/api/processos/importar) falha e o detalhe
-- do processo referencia colunas inexistentes.
-- =============================================================================

ALTER TABLE public.processos_juridicos
  ADD COLUMN IF NOT EXISTS providencia    text,
  ADD COLUMN IF NOT EXISTS status_interno text,
  ADD COLUMN IF NOT EXISTS indicacao      text;

NOTIFY pgrst, 'reload schema';
