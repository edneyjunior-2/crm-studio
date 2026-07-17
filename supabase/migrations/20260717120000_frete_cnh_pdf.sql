-- ============================================================================
-- CRM Studio — Frete: readiciona PDF na leitura de CNH
-- ============================================================================
-- PDF tinha sido removido da whitelist do bucket em
-- 20260716200000_frete_motoristas_documentos.sql (achado do review: o
-- endpoint Vision usado, images:annotate, não rasteriza PDF). Só que PDF é
-- exatamente o formato que o app oficial CNH Digital exporta — excluir PDF
-- quebrava o caso de uso mais comum de "CNH digital" pro usuário.
--
-- Fix real (2026-07-17): PDF usa um endpoint DIFERENTE do Vision
-- (files:annotate + DOCUMENT_TEXT_DETECTION, não images:annotate), testado
-- com chamada real antes de reativar (ver src/lib/frete/cnh-ocr-parser.ts).
-- ============================================================================

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
WHERE id = 'frete-motoristas-docs';

NOTIFY pgrst, 'reload schema';
