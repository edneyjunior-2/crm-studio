-- Preço real pago: suporte a multas e juros em pagamentos com atraso
ALTER TABLE contas_pagar
  ADD COLUMN IF NOT EXISTS valor_pago  numeric,
  ADD COLUMN IF NOT EXISTS multa       numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS juros       numeric NOT NULL DEFAULT 0;
