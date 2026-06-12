CREATE TABLE public.fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  telefone text,
  pix_tipo text CHECK (pix_tipo IN ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria')),
  pix_chave text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- RLS: apenas admin e socio
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fornecedores_select" ON public.fornecedores FOR SELECT
  USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin','socio')));

CREATE POLICY "fornecedores_insert" ON public.fornecedores FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin','socio')));

CREATE POLICY "fornecedores_update" ON public.fornecedores FOR UPDATE
  USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin','socio')));

CREATE POLICY "fornecedores_delete" ON public.fornecedores FOR DELETE
  USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin','socio')));

-- FK em contas_pagar (nullable — manter o text field para retrocompat)
ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
