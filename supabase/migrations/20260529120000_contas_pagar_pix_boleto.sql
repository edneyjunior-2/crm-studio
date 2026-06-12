ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS pix_copia_cola text;
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS codigo_boleto text;
NOTIFY pgrst, 'reload schema';
