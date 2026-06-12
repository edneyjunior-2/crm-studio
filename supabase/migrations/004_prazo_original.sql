ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS data_previsao_original date;

UPDATE public.negocios
  SET data_previsao_original = data_previsao_fechamento
  WHERE data_previsao_original IS NULL AND data_previsao_fechamento IS NOT NULL;

NOTIFY pgrst, 'reload schema';
