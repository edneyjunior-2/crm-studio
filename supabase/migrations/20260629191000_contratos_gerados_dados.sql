-- Re-edição: além do PDF (storage_path), guarda os DADOS que preencheram o
-- contrato (campos do formulário) p/ re-abrir o gerador pré-preenchido e editar
-- cláusulas. O postMessage do gerador já manda { mode, fields } — salvamos aqui.
alter table public.contratos_gerados add column if not exists dados jsonb;

notify pgrst, 'reload schema';
