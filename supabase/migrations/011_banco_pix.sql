-- PIX nas contas bancárias
ALTER TABLE public.bancos
  ADD COLUMN IF NOT EXISTS pix_tipo text
    CHECK (pix_tipo IN ('cpf','cnpj','email','telefone','aleatoria')),
  ADD COLUMN IF NOT EXISTS pix_chave text;

NOTIFY pgrst, 'reload schema';
