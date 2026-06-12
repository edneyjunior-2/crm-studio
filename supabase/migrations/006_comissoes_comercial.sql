-- Comissões para usuários comerciais
-- Admin/sócio lança a previsão; comercial só visualiza os próprios registros

CREATE TABLE IF NOT EXISTS public.comissoes_comercial (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  comercial_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  negocio_id      uuid        REFERENCES public.negocios(id) ON DELETE SET NULL,
  descricao       text        NOT NULL,
  valor           numeric(12,2) NOT NULL CHECK (valor > 0),
  data_previsao   date        NOT NULL,
  data_pagamento  date,
  status          text        NOT NULL DEFAULT 'previsto'
                              CHECK (status IN ('previsto', 'pago', 'cancelado')),
  observacoes     text,
  created_by      uuid        REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.comissoes_comercial ENABLE ROW LEVEL SECURITY;

-- Admin/sócio: acesso total
CREATE POLICY "comissoes_select_admin_socio" ON public.comissoes_comercial
  FOR SELECT TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','socio'));

CREATE POLICY "comissoes_insert" ON public.comissoes_comercial
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','socio'));

CREATE POLICY "comissoes_update" ON public.comissoes_comercial
  FOR UPDATE TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','socio'));

CREATE POLICY "comissoes_delete" ON public.comissoes_comercial
  FOR DELETE TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','socio'));

-- Comercial: só vê os próprios registros
CREATE POLICY "comissoes_select_comercial" ON public.comissoes_comercial
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'comercial'
    AND comercial_id = auth.uid()
  );

-- Índices
CREATE INDEX IF NOT EXISTS idx_comissoes_comercial_id   ON public.comissoes_comercial(comercial_id);
CREATE INDEX IF NOT EXISTS idx_comissoes_negocio_id     ON public.comissoes_comercial(negocio_id);
CREATE INDEX IF NOT EXISTS idx_comissoes_status         ON public.comissoes_comercial(status);
CREATE INDEX IF NOT EXISTS idx_comissoes_data_previsao  ON public.comissoes_comercial(data_previsao);

NOTIFY pgrst, 'reload schema';
