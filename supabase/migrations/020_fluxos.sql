-- =============================================================================
-- Migration 020 — Módulo de Fluxos (Kanban interno)
--
-- Cria três tabelas:
--   fluxos        → boards criados por admin/socio
--   fluxo_colunas → colunas customizáveis de cada board
--   fluxo_cards   → cards dentro de cada coluna
--
-- Visibilidade do board controla se o time comercial consegue ver.
-- RLS garante que comercial só acessa boards com visibilidade='todos_comerciais'.
-- =============================================================================

BEGIN;

-- =============================================================================
-- TABELAS
-- =============================================================================

-- Boards de fluxo criados por admin ou sócio
CREATE TABLE public.fluxos (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo       text        NOT NULL,
  descricao    text,
  owner_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  visibilidade text        NOT NULL DEFAULT 'privado'
                           CHECK (visibilidade IN ('privado', 'todos_comerciais')),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

COMMENT ON TABLE  public.fluxos              IS 'Boards do Kanban de fluxos internos.';
COMMENT ON COLUMN public.fluxos.visibilidade IS 'privado = só owner+admin; todos_comerciais = time inteiro.';

-- Colunas de cada board (o "status" é o título da coluna, editável)
CREATE TABLE public.fluxo_colunas (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  fluxo_id   uuid        NOT NULL REFERENCES public.fluxos(id) ON DELETE CASCADE,
  titulo     text        NOT NULL,
  cor        text        NOT NULL DEFAULT '#6B7280',
  ordem      int         NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.fluxo_colunas IS 'Colunas (status editável) de cada board de fluxo.';

-- Cards dentro de cada coluna
CREATE TABLE public.fluxo_cards (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  fluxo_id       uuid        NOT NULL REFERENCES public.fluxos(id)        ON DELETE CASCADE,
  coluna_id      uuid        NOT NULL REFERENCES public.fluxo_colunas(id) ON DELETE CASCADE,
  titulo         text        NOT NULL,
  descricao      text,
  responsavel_id uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  ordem          int         NOT NULL DEFAULT 0,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

COMMENT ON TABLE public.fluxo_cards IS 'Cards do Kanban; podem ser movidos entre colunas do mesmo board.';

-- =============================================================================
-- ÍNDICES
-- =============================================================================

-- fluxos: buscas por dono e por visibilidade (usados nas policies e nas queries)
CREATE INDEX idx_fluxos_owner_id     ON public.fluxos(owner_id);
CREATE INDEX idx_fluxos_visibilidade ON public.fluxos(visibilidade);

-- fluxo_colunas: lookup por board e ordenação
CREATE INDEX idx_fluxo_colunas_fluxo_id ON public.fluxo_colunas(fluxo_id);
CREATE INDEX idx_fluxo_colunas_ordem    ON public.fluxo_colunas(fluxo_id, ordem);

-- fluxo_cards: lookup por board, por coluna, por responsável e ordenação
CREATE INDEX idx_fluxo_cards_fluxo_id       ON public.fluxo_cards(fluxo_id);
CREATE INDEX idx_fluxo_cards_coluna_id      ON public.fluxo_cards(coluna_id);
CREATE INDEX idx_fluxo_cards_responsavel_id ON public.fluxo_cards(responsavel_id);
CREATE INDEX idx_fluxo_cards_ordem          ON public.fluxo_cards(coluna_id, ordem);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.fluxos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fluxo_colunas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fluxo_cards   ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Helper: verifica se o usuário corrente pode VER um determinado fluxo.
-- Usado nas policies de fluxo_colunas e fluxo_cards para evitar repetição.
-- SECURITY DEFINER + search_path para contornar RLS circular.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_fluxo(p_fluxo_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.fluxos f
    WHERE f.id = p_fluxo_id
      AND (
        f.owner_id = auth.uid()
        OR public.get_my_role() = 'admin'
        OR (f.visibilidade = 'todos_comerciais' AND auth.uid() IS NOT NULL)
      )
  );
$$;

-- Helper: verifica se o usuário corrente pode GERENCIAR (editar/deletar) um fluxo.
CREATE OR REPLACE FUNCTION public.can_manage_fluxo(p_fluxo_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.fluxos f
    WHERE f.id = p_fluxo_id
      AND (
        f.owner_id = auth.uid()
        OR public.get_my_role() = 'admin'
      )
  );
$$;

-- =============================================================================
-- POLICIES: fluxos
-- =============================================================================

-- SELECT: owner, admin, ou qualquer autenticado quando visibilidade='todos_comerciais'
CREATE POLICY "fluxos_select"
  ON public.fluxos
  FOR SELECT
  USING (
    owner_id = auth.uid()
    OR public.get_my_role() = 'admin'
    OR (visibilidade = 'todos_comerciais' AND auth.uid() IS NOT NULL)
  );

-- INSERT: apenas admin e socio podem criar boards; owner_id deve ser o próprio usuário
CREATE POLICY "fluxos_insert"
  ON public.fluxos
  FOR INSERT
  WITH CHECK (
    public.get_my_role() IN ('admin', 'socio')
    AND owner_id = auth.uid()
  );

-- UPDATE: owner ou admin
CREATE POLICY "fluxos_update"
  ON public.fluxos
  FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR public.get_my_role() = 'admin'
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR public.get_my_role() = 'admin'
  );

-- DELETE: owner ou admin
CREATE POLICY "fluxos_delete"
  ON public.fluxos
  FOR DELETE
  USING (
    owner_id = auth.uid()
    OR public.get_my_role() = 'admin'
  );

-- =============================================================================
-- POLICIES: fluxo_colunas
-- =============================================================================

-- SELECT: delega ao can_view_fluxo — mesma regra de visibilidade do board pai
CREATE POLICY "fluxo_colunas_select"
  ON public.fluxo_colunas
  FOR SELECT
  USING (public.can_view_fluxo(fluxo_id));

-- INSERT: apenas quem gerencia o board pai
CREATE POLICY "fluxo_colunas_insert"
  ON public.fluxo_colunas
  FOR INSERT
  WITH CHECK (public.can_manage_fluxo(fluxo_id));

-- UPDATE: apenas quem gerencia o board pai
CREATE POLICY "fluxo_colunas_update"
  ON public.fluxo_colunas
  FOR UPDATE
  USING  (public.can_manage_fluxo(fluxo_id))
  WITH CHECK (public.can_manage_fluxo(fluxo_id));

-- DELETE: apenas quem gerencia o board pai
CREATE POLICY "fluxo_colunas_delete"
  ON public.fluxo_colunas
  FOR DELETE
  USING (public.can_manage_fluxo(fluxo_id));

-- =============================================================================
-- POLICIES: fluxo_cards
-- =============================================================================

-- SELECT: delega ao can_view_fluxo
CREATE POLICY "fluxo_cards_select"
  ON public.fluxo_cards
  FOR SELECT
  USING (public.can_view_fluxo(fluxo_id));

-- INSERT: apenas quem gerencia o board pai
CREATE POLICY "fluxo_cards_insert"
  ON public.fluxo_cards
  FOR INSERT
  WITH CHECK (public.can_manage_fluxo(fluxo_id));

-- UPDATE: qualquer um que PODE VER o board pode mover/editar cards
--         (necessário para comercial arrastar cards quando visibilidade='todos_comerciais')
CREATE POLICY "fluxo_cards_update"
  ON public.fluxo_cards
  FOR UPDATE
  USING  (public.can_view_fluxo(fluxo_id))
  WITH CHECK (public.can_view_fluxo(fluxo_id));

-- DELETE: apenas quem gerencia o board pai
CREATE POLICY "fluxo_cards_delete"
  ON public.fluxo_cards
  FOR DELETE
  USING (public.can_manage_fluxo(fluxo_id));

-- =============================================================================
-- Sinaliza ao PostgREST para recarregar o schema
-- =============================================================================

NOTIFY pgrst, 'reload schema';

COMMIT;
