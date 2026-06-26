-- Adiciona coluna codigo_acesso na tabela empresas
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS codigo_acesso text UNIQUE;

-- Gera códigos para empresas que ainda não têm
-- Formato: 3 primeiras letras do nome (maiúsculo) + '-' + 4 dígitos
UPDATE public.empresas
SET codigo_acesso = UPPER(
    SUBSTRING(regexp_replace(nome, '[^a-zA-Z]', '', 'g'), 1, 3)
  ) || '-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::text, 4, '0')
WHERE codigo_acesso IS NULL;

-- Garante que novas empresas criadas pelo trigger também recebam código
CREATE OR REPLACE FUNCTION public.gerar_codigo_acesso()
RETURNS TRIGGER AS $$
DECLARE
  prefixo text;
  sufixo  text;
  novo    text;
BEGIN
  prefixo := UPPER(SUBSTRING(regexp_replace(NEW.nome, '[^a-zA-Z]', '', 'g'), 1, 3));
  IF length(prefixo) < 3 THEN
    prefixo := RPAD(prefixo, 3, 'X');
  END IF;
  LOOP
    sufixo := LPAD(FLOOR(RANDOM() * 9000 + 1000)::text, 4, '0');
    novo   := prefixo || '-' || sufixo;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.empresas WHERE codigo_acesso = novo);
  END LOOP;
  NEW.codigo_acesso := novo;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gerar_codigo_acesso ON public.empresas;
CREATE TRIGGER trg_gerar_codigo_acesso
  BEFORE INSERT ON public.empresas
  FOR EACH ROW
  WHEN (NEW.codigo_acesso IS NULL)
  EXECUTE FUNCTION public.gerar_codigo_acesso();

NOTIFY pgrst, 'reload schema';
