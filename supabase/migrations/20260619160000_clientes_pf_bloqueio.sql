ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS tipo_pessoa text NOT NULL DEFAULT 'pj' CHECK (tipo_pessoa IN ('pj','pf')),
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS bloqueio_exclusividade boolean NOT NULL DEFAULT true;
NOTIFY pgrst, 'reload schema';
