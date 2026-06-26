-- Valor mensal acordado com o cliente (cobrança feita fora do sistema)
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS valor_mensalidade numeric(10,2) DEFAULT 0;

NOTIFY pgrst, 'reload schema';
