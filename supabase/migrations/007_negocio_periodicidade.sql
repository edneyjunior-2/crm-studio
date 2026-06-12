-- Periodicidade e fechamento para negócios ganhos
-- Motivo de perda para negócios perdidos
ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS periodicidade   text
    CHECK (periodicidade IN ('unico', 'mensal', 'trimestral', 'semestral', 'anual')),
  ADD COLUMN IF NOT EXISTS data_fechamento date,
  ADD COLUMN IF NOT EXISTS motivo_perda    text;

NOTIFY pgrst, 'reload schema';
