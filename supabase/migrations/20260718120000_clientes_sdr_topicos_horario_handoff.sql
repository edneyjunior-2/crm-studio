-- Leila: tópicos proibidos extras, horário de expediente e handoff por palavra-chave.
-- Todas as colunas são opcionais — ausência = comportamento atual preservado (sem regressão).
alter table public.clientes_sdr
  add column if not exists topicos_proibidos      text,
  add column if not exists horario_inicio         text,
  add column if not exists horario_fim             text,
  add column if not exists dias_uteis              smallint[],
  add column if not exists palavras_chave_handoff  text,
  add column if not exists mensagem_fora_horario   text,
  add column if not exists mensagem_handoff        text;

notify pgrst, 'reload schema';
