-- Comissão do parceiro
ALTER TABLE public.parceiros
  ADD COLUMN IF NOT EXISTS comissao_percentual numeric(5,2);

-- Recorrência em contas a pagar
ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS recorrente        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS frequencia        text CHECK (frequencia IN ('semanal','mensal','semestral','anual'));

-- Contas bancárias
CREATE TABLE IF NOT EXISTS public.bancos (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          text        NOT NULL,
  instituicao   text,
  agencia       text,
  conta         text,
  tipo          text        NOT NULL DEFAULT 'corrente'
                            CHECK (tipo IN ('corrente','poupanca','investimento','caixa')),
  saldo_inicial numeric(12,2) NOT NULL DEFAULT 0,
  ativo         boolean     NOT NULL DEFAULT true,
  created_by    uuid        REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Movimentações financeiras (entradas e saídas por conta)
CREATE TABLE IF NOT EXISTS public.movimentacoes (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  banco_id          uuid        NOT NULL REFERENCES public.bancos(id) ON DELETE RESTRICT,
  tipo              text        NOT NULL CHECK (tipo IN ('entrada','saida')),
  valor             numeric(12,2) NOT NULL,
  descricao         text        NOT NULL,
  categoria         text,
  destino_origem    text,
  data              date        NOT NULL,
  conta_pagar_id    uuid        REFERENCES public.contas_pagar(id) ON DELETE SET NULL,
  conta_receber_id  uuid        REFERENCES public.contas_receber(id) ON DELETE SET NULL,
  created_by        uuid        REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- RLS bancos
ALTER TABLE public.bancos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bancos_select" ON public.bancos FOR SELECT TO authenticated USING (true);
CREATE POLICY "bancos_insert" ON public.bancos FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','socio'));
CREATE POLICY "bancos_update" ON public.bancos FOR UPDATE TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','socio'));
CREATE POLICY "bancos_delete" ON public.bancos FOR DELETE TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','socio'));

-- RLS movimentacoes
ALTER TABLE public.movimentacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "movimentacoes_select" ON public.movimentacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "movimentacoes_insert" ON public.movimentacoes FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','socio'));
CREATE POLICY "movimentacoes_update" ON public.movimentacoes FOR UPDATE TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','socio'));
CREATE POLICY "movimentacoes_delete" ON public.movimentacoes FOR DELETE TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','socio'));

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_movimentacoes_banco_id ON public.movimentacoes(banco_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_data ON public.movimentacoes(data);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_tipo ON public.movimentacoes(tipo);

NOTIFY pgrst, 'reload schema';
