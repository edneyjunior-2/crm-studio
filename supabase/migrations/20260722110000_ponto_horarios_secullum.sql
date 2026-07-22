-- ============================================================================
-- CRM Studio — Ponto: horários batidos + tipo do dia
-- ============================================================================
-- Aditivo, não quebra nada existente: colunas novas com defaults seguros.
-- Motivação: importar folhas de ponto externas (ex.: Secullum) preservando o
-- horário batido (entrada/saída) e o tipo do dia (falta, atestado, feriado,
-- folga por banco de horas), hoje reduzidos a um booleano presente/ausente.
-- ============================================================================

alter table public.pontos
  add column if not exists entrada_1 text,
  add column if not exists saida_1   text,
  add column if not exists entrada_2 text,
  add column if not exists saida_2   text,
  add column if not exists tipo_dia  text not null default 'normal'
    constraint pontos_tipo_dia_check
    check (tipo_dia in ('normal', 'falta', 'atestado', 'folga_banco_horas')),
  add column if not exists batida_manual boolean not null default false,
  add column if not exists origem text not null default 'manual'
    constraint pontos_origem_check
    check (origem in ('manual', 'importado_secullum'));

comment on column public.pontos.entrada_1 is 'Horário HH:MM do 1º turno (entrada). Null quando não há registro de horário (ex.: falta).';
comment on column public.pontos.saida_1   is 'Horário HH:MM do 1º turno (saída).';
comment on column public.pontos.entrada_2 is 'Horário HH:MM do 2º turno (entrada), quando há intervalo.';
comment on column public.pontos.saida_2   is 'Horário HH:MM do 2º turno (saída).';
comment on column public.pontos.tipo_dia  is 'Situação do dia: normal (trabalhou), falta, atestado, folga_banco_horas. Feriado e folga semanal não geram linha (derivados do calendário).';
comment on column public.pontos.batida_manual is 'true quando o horário foi lançado manualmente (não bateu no relógio/app), ex.: marcação (*) da Secullum.';
comment on column public.pontos.origem is 'Origem do registro: manual (lançado na tela de Ponto Diário) ou importado_secullum (importação de folha externa).';

notify pgrst, 'reload schema';
