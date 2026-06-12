-- Suporte a parcelamento no cartão de crédito em contas a pagar
ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS is_cartao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cartao_info text;     -- ex: "Cartão Edney Visa 1234"

NOTIFY pgrst, 'reload schema';
