-- Sugestão de melhoria do tom de voz escrita pelo admin (somente-leitura para o cliente)
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS sugestao_sdr text;

NOTIFY pgrst, 'reload schema';
