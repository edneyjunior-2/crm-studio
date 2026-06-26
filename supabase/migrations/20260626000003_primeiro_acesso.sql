-- Rastreia quando o cliente acessou o CRM pela primeira vez
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS primeiro_acesso_em timestamptz;

NOTIFY pgrst, 'reload schema';
