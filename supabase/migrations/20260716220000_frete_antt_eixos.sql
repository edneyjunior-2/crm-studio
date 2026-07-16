-- ============================================================================
-- CRM Studio — Frete: número de eixos como dimensão real do piso ANTT
-- ============================================================================
-- Achado (2026-07-16, comparando com planilha de referência de um parceiro
-- transportador + leitura direta do texto legal em anttlegis.antt.gov.br):
-- o coeficiente CCD/CC da tabela ANTT NÃO depende só de tabela_antt+tipo_carga
-- — varia também pelo número de eixos carregados do veículo combinado (2, 3,
-- 4, 5, 6, 7, 9), dentro da MESMA tabela e MESMO tipo de carga. A migration
-- anterior (20260716140500_modulo_frete_schema.sql) não tinha essa dimensão —
-- este é o fix.
--
-- Fonte: Portaria SUROC nº 4/2026 (20/03/2026), que atualiza o Anexo II da
-- Resolução ANTT 5.867/2020 (com as alterações da Resolução 6.076/2026).
-- Valores de "Carga Geral" cross-validados com planilha de referência de
-- parceiro do setor (mesma fonte primária citada); valores de "Granel
-- Sólido" lidos direto do texto legal em anttlegis.antt.gov.br.
-- ============================================================================

-- 1) Coluna eixos (nullable por enquanto — sem dados legados a preservar)
ALTER TABLE public.frete_antt_coeficientes ADD COLUMN eixos smallint;

-- 2) Remove a linha placeholder antiga (Tabela A / geral, sem eixos) — vai
--    ser substituída pelas 7 linhas reais por eixo, abaixo.
DELETE FROM public.frete_antt_coeficientes
  WHERE tabela_antt = 'A' AND tipo_carga = 'geral' AND eixos IS NULL;

-- 3) Troca o UNIQUE antigo (sem eixos) pelo novo (com eixos) — busca o nome
--    do constraint por inspeção em vez de cravar, robusto a reaplicação manual.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.frete_antt_coeficientes'::regclass
      AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.frete_antt_coeficientes DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.frete_antt_coeficientes ALTER COLUMN eixos SET NOT NULL;

ALTER TABLE public.frete_antt_coeficientes
  ADD CONSTRAINT frete_antt_coeficientes_tabela_tipo_eixos_vigencia_key
  UNIQUE (tabela_antt, tipo_carga, eixos, vigencia_inicio);

-- 4) Seed real — Tabela A, 2 tipos de carga × 7 faixas de eixo (2,3,4,5,6,7,9).
--    Continua valendo o mesmo aviso da migration anterior: as demais
--    combinações (Tabelas B/C/D e os outros 10 tipos de carga da metodologia
--    oficial) seguem PENDENTES de transcrição manual — buscarCoeficienteVigente()
--    retorna null pra qualquer combinação não cadastrada, e o cálculo é
--    bloqueado nesse caso (nunca chuta).
INSERT INTO public.frete_antt_coeficientes (tabela_antt, tipo_carga, eixos, ccd, cc, vigencia_inicio, fonte) VALUES
  ('A', 'geral',         2, 4.0031, 436.39, '2026-03-20', 'Portaria SUROC nº 4/2026 (Tabela A, Carga Geral) — cross-validado com planilha de referência de parceiro do setor'),
  ('A', 'geral',         3, 5.1295, 523.33, '2026-03-20', 'Portaria SUROC nº 4/2026 (Tabela A, Carga Geral)'),
  ('A', 'geral',         4, 5.8178, 568.72, '2026-03-20', 'Portaria SUROC nº 4/2026 (Tabela A, Carga Geral)'),
  ('A', 'geral',         5, 6.7126, 635.08, '2026-03-20', 'Portaria SUROC nº 4/2026 (Tabela A, Carga Geral)'),
  ('A', 'geral',         6, 7.4124, 648.95, '2026-03-20', 'Portaria SUROC nº 4/2026 (Tabela A, Carga Geral)'),
  ('A', 'geral',         7, 8.1252, 803.22, '2026-03-20', 'Portaria SUROC nº 4/2026 (Tabela A, Carga Geral)'),
  ('A', 'geral',         9, 9.2466, 872.44, '2026-03-20', 'Portaria SUROC nº 4/2026 (Tabela A, Carga Geral)'),
  ('A', 'granel_solido', 2, 4.0338, 444.84, '2026-03-20', 'Portaria SUROC nº 4/2026 (Tabela A, Granel Sólido) — lido direto de anttlegis.antt.gov.br'),
  ('A', 'granel_solido', 3, 5.1660, 533.36, '2026-03-20', 'Portaria SUROC nº 4/2026 (Tabela A, Granel Sólido)'),
  ('A', 'granel_solido', 4, 5.8464, 576.59, '2026-03-20', 'Portaria SUROC nº 4/2026 (Tabela A, Granel Sólido)'),
  ('A', 'granel_solido', 5, 6.7381, 642.10, '2026-03-20', 'Portaria SUROC nº 4/2026 (Tabela A, Granel Sólido)'),
  ('A', 'granel_solido', 6, 7.4408, 656.76, '2026-03-20', 'Portaria SUROC nº 4/2026 (Tabela A, Granel Sólido)'),
  ('A', 'granel_solido', 7, 8.0855, 792.30, '2026-03-20', 'Portaria SUROC nº 4/2026 (Tabela A, Granel Sólido)'),
  ('A', 'granel_solido', 9, 9.2662, 877.83, '2026-03-20', 'Portaria SUROC nº 4/2026 (Tabela A, Granel Sólido)');

-- 5) frete_cotacoes também precisa registrar qual eixo foi usado no cálculo
--    (auditabilidade — nunca recalcular o histórico com coeficiente diferente
--    do que gerou o valor_piso_antt gravado).
ALTER TABLE public.frete_cotacoes ADD COLUMN eixos smallint;

NOTIFY pgrst, 'reload schema';
