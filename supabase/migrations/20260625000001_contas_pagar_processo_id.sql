-- Vincula contas a pagar a processos jurídicos (QW#2 — Solicitar pagamento de guia)
ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS processo_id uuid REFERENCES public.processos_juridicos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contas_pagar_processo
  ON public.contas_pagar(processo_id)
  WHERE processo_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
