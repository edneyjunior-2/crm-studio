-- Vincula contas a receber a processos jurídicos (aba Honorários do Financeiro) —
-- mesmo padrão já usado em contas_pagar (20260625000001_contas_pagar_processo_id.sql,
-- QW#2 "Solicitar pagamento de guia"), agora do lado de receita.
ALTER TABLE public.contas_receber
  ADD COLUMN IF NOT EXISTS processo_id uuid REFERENCES public.processos_juridicos(id) ON DELETE SET NULL;

-- UNIQUE parcial: no máximo 1 honorário lançado por processo. Garantia no banco,
-- não só na aplicação — evita corrida de duplo-clique/2 abas criando 2 lançamentos
-- pro mesmo processo (mesmo princípio já registrado em outras mutações do projeto:
-- trava no banco, não "ler depois escrever").
CREATE UNIQUE INDEX IF NOT EXISTS idx_contas_receber_processo_unico
  ON public.contas_receber(processo_id)
  WHERE processo_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
