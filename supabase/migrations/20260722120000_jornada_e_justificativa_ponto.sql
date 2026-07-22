-- ============================================================================
-- CRM Studio — Jornada semanal + justificativa por dia (banco de horas)
-- ============================================================================
-- Aditivo: colunas novas, nullable, não afetam nenhuma linha/consulta existente.
-- 1) jornada_semanal: minutos esperados de trabalho por dia da semana, pra
--    comparar com as horas batidas (entrada/saída de `pontos`) e calcular
--    crédito/débito de banco de horas na tela /rh/ponto/cartao.
-- 2) tipo_justificativa: categoriza a justificativa livre que já existia em
--    pontos.justificativa (atestado médico, atestado de comparecimento,
--    liberação da empresa, outro) — usada pelo RH pra justificar qualquer
--    dia (não só falta, ex.: saída antecipada liberada), o que isenta aquele
--    dia do débito de banco de horas.
-- ============================================================================

alter table public.colaboradores
  add column if not exists jornada_semanal jsonb;

comment on column public.colaboradores.jornada_semanal is
  'Minutos esperados de trabalho por dia da semana, ex.: {"seg":540,"ter":540,"qua":540,"qui":540,"sex":480,"sab":0,"dom":0}. Null = jornada não cadastrada (banco de horas não é calculado).';

alter table public.pontos
  add column if not exists tipo_justificativa text
    constraint pontos_tipo_justificativa_check
    check (tipo_justificativa in ('atestado_medico', 'atestado_comparecimento', 'liberacao_empresa', 'outro'));

comment on column public.pontos.tipo_justificativa is
  'Categoria da justificativa (pontos.justificativa/documento_path) lançada pelo RH. Um dia com tipo_justificativa preenchido não gera débito de banco de horas, mesmo que as horas batidas fiquem abaixo da jornada esperada.';

notify pgrst, 'reload schema';
