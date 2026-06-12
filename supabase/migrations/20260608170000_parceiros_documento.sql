-- Parceiros: campos de documento/endereço vindos do gerador de contrato
-- e índices para deduplicação por CPF/CNPJ.
-- Aditivo e idempotente (não altera dados existentes).

ALTER TABLE public.parceiros
  ADD COLUMN IF NOT EXISTS cnpj         text,
  ADD COLUMN IF NOT EXISTS cpf          text,
  ADD COLUMN IF NOT EXISTS endereco     text,
  ADD COLUMN IF NOT EXISTS tipo_pessoa  text;  -- 'pf' | 'pj'

-- Busca/dedup por documento (parcial: ignora nulos dos parceiros já existentes)
CREATE INDEX IF NOT EXISTS idx_parceiros_cnpj ON public.parceiros (cnpj) WHERE cnpj IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_parceiros_cpf  ON public.parceiros (cpf)  WHERE cpf  IS NOT NULL;

-- Recarrega o schema cache do PostgREST
NOTIFY pgrst, 'reload schema';
