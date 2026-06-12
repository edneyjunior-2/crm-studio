-- Suporte a múltiplas moedas em contas a pagar, receber e movimentações
ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS moeda text NOT NULL DEFAULT 'BRL'
    CHECK (moeda IN ('BRL','USD','EUR','GBP','ARS'));

ALTER TABLE public.contas_receber
  ADD COLUMN IF NOT EXISTS moeda text NOT NULL DEFAULT 'BRL'
    CHECK (moeda IN ('BRL','USD','EUR','GBP','ARS'));

ALTER TABLE public.movimentacoes
  ADD COLUMN IF NOT EXISTS moeda text NOT NULL DEFAULT 'BRL'
    CHECK (moeda IN ('BRL','USD','EUR','GBP','ARS'));

NOTIFY pgrst, 'reload schema';
