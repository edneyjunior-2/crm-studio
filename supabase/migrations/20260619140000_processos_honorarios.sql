-- =============================================================================
-- Honorários do advogado por processo
-- valor_causa = valor global da causa (o que está em disputa).
-- honorário   = o que o advogado efetivamente ganha: pode ser um valor FIXO
--               (R$) ou um PERCENTUAL do valor da causa (ex.: 20%).
-- =============================================================================

ALTER TABLE public.processos_juridicos
  ADD COLUMN IF NOT EXISTS honorarios_tipo  text
    CHECK (honorarios_tipo IN ('fixo', 'percentual')),
  ADD COLUMN IF NOT EXISTS honorarios_valor numeric(15,2);

COMMENT ON COLUMN public.processos_juridicos.honorarios_tipo IS
  'fixo = honorarios_valor em R$; percentual = honorarios_valor em % do valor_causa';

NOTIFY pgrst, 'reload schema';
