CREATE TABLE IF NOT EXISTS public.parceiros (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome              text        NOT NULL,
  empresa           text,
  contato_email     text,
  contato_telefone  text,
  contrato_assinado boolean     NOT NULL DEFAULT false,
  data_contrato     date,
  observacoes       text,
  created_by        uuid        REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.parceiros ENABLE ROW LEVEL SECURITY;

-- Todos os autenticados podem ver parceiros
CREATE POLICY "parceiros_select" ON public.parceiros
  FOR SELECT TO authenticated USING (true);

-- Apenas admin e socio podem criar/editar/excluir
CREATE POLICY "parceiros_insert" ON public.parceiros
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'socio')
  );

CREATE POLICY "parceiros_update" ON public.parceiros
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'socio')
  );

CREATE POLICY "parceiros_delete" ON public.parceiros
  FOR DELETE TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'socio')
  );

-- Adiciona campos de origem na tabela clientes
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS origem_tipo  text CHECK (origem_tipo IN ('prospeccao_direta','parceiro','indicacao_interna')),
  ADD COLUMN IF NOT EXISTS parceiro_id  uuid REFERENCES public.parceiros(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS indicado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
