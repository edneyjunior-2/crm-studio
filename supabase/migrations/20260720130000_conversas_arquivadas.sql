-- Arquivar conversas do Atendimento (inbox do WhatsApp).
--
-- Campo ortogonal ao `status` (bot|humano|resolvido|adiado): status pertence
-- ao fluxo do bot SDR (Leila) e das automações; arquivar é só organização
-- visual do inbox humano. Por isso NÃO mexemos em status — uma conversa
-- arquivada pode continuar em qualquer status e o bot segue funcionando nela.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS arquivada boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
