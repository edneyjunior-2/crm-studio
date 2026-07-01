-- Constraints UNIQUE que eliminam corridas confirmadas na 2ª auditoria.
-- (Verificado: sem duplicatas existentes antes de aplicar.)

-- 1 medição por número por obra (corrida em numero_medicao)
create unique index if not exists uq_obras_medicoes_obra_numero
  on public.obras_medicoes (obra_id, numero_medicao);

-- 1 movimentação por conta (double-spend em marcarRecebido/marcarPago)
create unique index if not exists uq_movimentacoes_conta_receber
  on public.movimentacoes (conta_receber_id) where conta_receber_id is not null;
create unique index if not exists uq_movimentacoes_conta_pagar
  on public.movimentacoes (conta_pagar_id) where conta_pagar_id is not null;

-- 1 assinatura ativa por empresa (duplo-submit em assinarPlano)
create unique index if not exists uq_assinaturas_empresa_ativa
  on public.assinaturas (empresa_id) where status <> 'cancelado';

-- 1 lançamento de folha por colaborador por competência
create unique index if not exists uq_lancamentos_folha_colab_comp
  on public.lancamentos_folha (empresa_id, colaborador_id, competencia);

notify pgrst, 'reload schema';
