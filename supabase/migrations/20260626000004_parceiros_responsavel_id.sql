-- =============================================================================
-- Fix: parceiros sem responsavel_id no Studio
-- A página /parceiros faz embed `profiles!responsavel_id` e filtra por
-- responsável, mas a coluna nunca foi criada na tabela parceiros do Studio
-- (existia no Aurum). Sem ela, a query do PostgREST falha → "Erro ao carregar
-- parceiros". Mesmo padrão da migration 017 (clientes).
-- =============================================================================

ALTER TABLE public.parceiros
  ADD COLUMN IF NOT EXISTS responsavel_id uuid REFERENCES auth.users(id);

-- Popular com created_by para registros existentes (mesmo critério da 017)
UPDATE public.parceiros SET responsavel_id = created_by WHERE responsavel_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_parceiros_responsavel ON public.parceiros(responsavel_id);

NOTIFY pgrst, 'reload schema';
