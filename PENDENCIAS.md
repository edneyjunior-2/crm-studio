# Pendências — CRM Aurum

Backlog de features planejadas, ordenadas por prioridade. Mover para "Concluído" quando implementado.

---

## Em aberto

### Módulo Frete e Logística — ativação em produção
**Status:** código construído em 2026-07-16 (orquestração 4 streams: schema+calculadora ANTT, CRUD veículos/motoristas/cotações, OCR de CNH, oferta em `/precos` R$397 + admin). Revisado (code review + security review) e corrigido. Falta só ativar:

1. **Aplicar as 3 migrations novas** (`supabase/migrations/202607161*.sql`) — precisa de autorização explícita, ainda não aplicadas.
2. **Configurar `GOOGLE_VISION_API_KEY`** (env var, Vercel + `.env.local`) — sem ela, a leitura automática de CNH falha com erro claro (não mascarado), mas fica indisponível até configurar. Conta Google Cloud com Vision API habilitada, chave de API simples (não service account).
3. **Completar a tabela `frete_antt_coeficientes`** — hoje só tem 1 linha de exemplo (Tabela A/geral, Resolução ANTT 6.076/2026). Precisa transcrever manualmente as demais combinações tabela×tipo de carga da fonte oficial (`calculadorafrete.antt.gov.br`) antes de anunciar a calculadora como cobrindo todos os tipos de carga.
4. Testar upload de CNH real (ângulos, iluminação, foto de celular) pra calibrar a confiança do parser — só testado contra texto simulado até aqui.

**Decisão de custo (2026-07-16):** OCR construído internamente (Google Vision + parser próprio) em vez de contratar Infosimples/idwall/CAF — sem cliente pagante ainda, custo fixo mensal (R$100 mínimo da Infosimples) não é opção.

**Contexto:** `research/25-modulo-frete-logistica-transportadora.md` (visão geral e MVP), `research/26-consulta-cnh-api-motorista.md` (por que não existe API só-por-número), `research/27-ocr-cnh-upload-foto.md` (provedores prontos vs. construir), specs em `.claude/specs/frete-01` a `frete-04`.

---

### Verificação OAuth do Google — Google Calendar
**Objetivo:** sair do modo de teste do app OAuth no Google Cloud Console. Sem
a verificação, o app fica limitado a ~100 usuários de teste cadastrados
manualmente e mostra a tela de aviso "Google não verificou este app" no
consentimento — trava a integração de Calendário pra qualquer cliente real.

**O que fazer:**
1. Atualizar `/privacidade` declarando explicitamente o uso do escopo do
   Google Calendar (quais dados o app lê/escreve, finalidade, tempo de
   retenção) — é um dos requisitos do processo de verificação do Google
   pra escopos sensíveis/restritos.
2. Gravar o vídeo de demonstração do fluxo OAuth (exigido na submissão).
3. Confirmar o domínio de produção verificado no Google Search Console
   (mesmo domínio usado no `redirect_uri`/`GOOGLE_REDIRECT_URI`).
4. Submeter pra verificação no Google Cloud Console → OAuth consent screen
   → Verification Center.

---

### Configuração do Resend (e-mail automático)
**Objetivo:** ativar o envio de e-mail automático nos follow-ups D+3/D+7 e futuros alertas financeiros.

**O que fazer:**
1. Criar conta em [resend.com](https://resend.com) (gratuito até 3.000 e-mails/mês)
2. Verificar domínio (ex: `@aurumtax.com.br`) nas configurações DNS
3. Gerar API Key e adicionar no `.env.local`: `RESEND_API_KEY=re_xxxxxxx`
4. Criar Edge Function `supabase/functions/notificar-followups/index.ts`:
   - Roda todo dia às 8h via pg_cron
   - Busca `followups` com `data_agendada <= hoje AND status = 'pendente'`
   - Para cada um, busca o e-mail do `responsavel_id` em `auth.users`
   - Envia e-mail via Resend com link direto para o pipeline
5. Registrar o cron: `SELECT cron.schedule('notificar-followups', '0 11 * * *', ...)`

**Modelo de e-mail:**
> Assunto: Lembrete de follow-up — [título do negócio]
> Olá [nome], você agendou um follow-up com [cliente] há X dias. Hora de entrar em contato.
> [Ver negócio no CRM →]

---

### Automações — Revisar e ampliar
**Objetivo:** expandir a página de Automações com novas regras e permitir configuração pelo admin.

**Novas automações a implementar:**
1. **Alerta de conta vencendo (D-3)** — cron diário + Edge Function + Resend
   - Busca contas com `data_vencimento = hoje + 3 dias AND status = 'pendente'`
   - Envia e-mail para admin/sócio responsável
2. **Relatório financeiro semanal** — toda segunda-feira às 8h
   - Resumo: a receber, a pagar, atrasadas, saldo por banco
   - Envia por e-mail via Resend para admin e sócios
3. **Relatório de comissões mensal** — todo dia 1º do mês
   - Calcula comissões por comercial do mês anterior
   - Envia e-mail personalizado para cada membro da equipe
4. **Negócio parado no pipeline** — cron diário
   - Detecta negócios sem atividade há X dias (configurável)
   - Alerta o responsável no dashboard + e-mail

**UI a adicionar na página `/automacoes`:**
- Toggle para ativar/desativar cada automação (tabela `automacoes_config`)
- Campo de configuração por automação (ex: quantos dias sem atividade = parado)
- Histórico das últimas execuções com status e resultado

---

### n8n — Hub de automação visual
**Objetivo:** instalar o n8n como central de integrações, conectando o CRM com Gmail, WhatsApp, planilhas e outros sistemas.

**Repositório de referência — n8n-mcp:**
👉 https://github.com/czlonkowski/n8n-mcp
Permite que o Claude Code interaja diretamente com o n8n via MCP — criar, editar e executar workflows pelo próprio CRM sem abrir o painel do n8n. Instalar antes de começar a construir os workflows.

**O que fazer:**
1. **Deploy do n8n** — duas opções:
   - Self-hosted em VPS (~R$ 30/mês no Railway ou Render) — recomendado
   - n8n Cloud — a partir de $20/mês
2. **Conectar com Supabase** — usar o node nativo do n8n para Supabase:
   - Trigger: Database Webhook do Supabase → n8n via HTTP
   - Ex: quando `negocios.estagio` muda → dispara workflow no n8n
3. **Automações iniciais via n8n:**
   - Notificação no WhatsApp (via Evolution API) quando negócio fecha
   - Sincronização de contatos com Google Contacts
   - Criação automática de evento no Google Calendar ao agendar reunião
   - Envio de proposta em PDF por e-mail diretamente do Gmail da equipe
4. **Evolution API** — WhatsApp Business open-source:
   - Deploy separado (Docker em VPS)
   - Conecta com n8n via HTTP node
   - Permite enviar mensagens do número da empresa

**Dependência:** Resend deve estar configurado antes (para os fluxos de e-mail via n8n).

---

### Site Institucional — crmstudio.com.br
**Objetivo:** criar o site de apresentação e venda do produto CRM Studio, a versão white-label do CRM Aurum.

**Domínio:** `crmstudio.com.br` — registrar no Registro.br (~R$ 40/ano)

**O que fazer:**
1. Registrar o domínio `crmstudio.com.br` no [registro.br](https://registro.br)
2. Criar repositório separado `crmstudio-site` (Next.js ou Astro — site estático/marketing)
3. Páginas do site:
   - **Home** — headline forte, proposta de valor, print do produto
   - **Módulos** — listar os 6 módulos (Core, Pipeline, Financeiro, Comissões, Parceiros, Automações) com descrição
   - **Planos** — tabela de preços por perfil de empresa (Vendas, Financeiro, Representação, Freelancer)
   - **Contato / Demo** — formulário para solicitar demonstração
4. Deploy no Vercel apontando para `crmstudio.com.br`
5. CTA principal: "Solicitar demonstração" → formulário ou WhatsApp

**Referência de posicionamento:** ver `WHITE_LABEL.md` para perfis de empresa e mapa de módulos.

---

### White-label: nome da empresa + logo
**Objetivo:** tornar o CRM vendável como produto white-label — cada instância tem seu próprio nome e identidade visual.

**O que fazer:**
1. **Migration `012_empresa_config.sql`** — tabela singleton `empresa_config (id, nome_empresa, logo_url, updated_at)` com RLS: leitura pública, escrita somente `admin`.
2. **Bucket Supabase Storage `logos`** — bucket público; criar via dashboard do Supabase.
3. **Página `/configuracoes`** (admin only) — formulário com:
   - Campo de texto: Nome da Empresa
   - Upload de logo (aceitar PNG/SVG, salvar no bucket `logos`, gravar URL em `logo_url`)
   - Preview ao vivo do logo
4. **Sidebar/Navbar** — ler `empresa_config` via SSR no `layout.tsx`; exibir logo quando `logo_url` preenchido, senão exibir texto `"CRM"` como fallback estilizado.

**Decisão técnica:** SSR direto no layout (sem cache extra) — suficiente para o volume atual de 4 usuários.

---

### Google Calendar — Sincronização de reuniões e atividades
**Objetivo:** quando uma atividade do tipo "reunião" for criada no pipeline, oferecer a opção de criar o evento automaticamente no Google Calendar do responsável.

**Status:** em implementação

**O que fazer:**
1. Criar projeto no Google Cloud Console, habilitar Calendar API, gerar OAuth 2.0 credentials
2. Adicionar env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
3. Migration `019_google_tokens.sql` — adicionar `google_access_token`, `google_refresh_token`, `google_token_expiry` em `profiles`
4. Rota OAuth: `/api/google/callback` — troca código por tokens e salva no perfil
5. Botão "Conectar Google Calendar" nas Configurações do usuário
6. Ao criar atividade tipo "reunião" → toggle "Adicionar ao Google Calendar"
7. API route `/api/google/calendar/events` para criar/deletar eventos

---

### Asaas — Cobrança PIX + Boleto automático
**Objetivo:** gerar cobranças (PIX, boleto, cartão) direto do CRM sem processo manual.

**O que fazer:**
1. Criar conta em [asaas.com](https://asaas.com) (sem mensalidade, pay-per-use)
2. Gerar API Key e adicionar no `.env.local`: `ASAAS_API_KEY=`
3. No módulo de contas a receber: botão "Gerar cobrança Asaas" no card
4. Webhook Asaas → `/api/asaas/webhook` → atualiza status da conta no CRM automaticamente
5. Exibir QR Code do PIX ou link do boleto direto na conta a receber

**Custo:** R$ 0,99-1,99 por transação recebida, sem mensalidade.

---

### NFS-e — Emissão de Nota Fiscal direto do CRM
**Objetivo:** emitir NFS-e para o município de Salvador-BA sem acessar o site da prefeitura.

**O que fazer:**
1. Obter certificado digital A1 (e-CNPJ tipo A1, ~R$ 300/ano)
2. Criar conta no Focus NFe — trial 30 dias grátis: [focusnfe.com.br](https://focusnfe.com.br)
3. Configurar inscrição municipal de Salvador no painel do hub
4. Adicionar env vars: `FOCUS_NFE_TOKEN=`, `FOCUS_NFE_CNPJ=`
5. No card de negócio "Fechado Ganho": botão "Emitir NFS-e"
6. Form preenche automaticamente: cliente, serviço, valor, data
7. Armazenar `.pfx` do certificado no Supabase Storage (bucket privado) — NUNCA via NEXT_PUBLIC

**Custo:** R$ 89,90/mês (100 NFs, 3 CNPJs) — Salvador suportado via padrão nacional.

---

### ZapSign — Assinatura digital de contratos e propostas
**Objetivo:** enviar proposta para assinatura digital sem imprimir ou escanear.

**O que fazer:**
1. Criar conta em [zapsign.co](https://zapsign.co) (R$ 79,90/mês, 900 docs/ano)
2. Gerar API Key e adicionar no `.env.local`: `ZAPSIGN_API_KEY=`
3. No card de negócio em estágio "Proposta": botão "Enviar para assinatura"
4. Upload do PDF da proposta → ZapSign gera link → cliente assina pelo celular
5. Webhook ZapSign → atualiza status do negócio quando assinado

**Validade jurídica:** Lei 14.063/2020 — plena.

---

### WhatsApp Business API
**Objetivo:** notificações automáticas de pipeline, follow-up e cobranças via WhatsApp.

**O que fazer:**
1. Verificar conta Meta Business em [business.facebook.com](https://business.facebook.com)
2. Criar WABA (WhatsApp Business Account) e número dedicado
3. Aprovar templates de mensagem (proposta, follow-up, cobrança)
4. Integrar via Twilio ou Zenvia (mais simples que API direta na fase inicial)
5. Gatilhos: negócio em proposta → WhatsApp automático | follow-up D+3 → WhatsApp | cobrança vencendo → WhatsApp

**Custo:** ~R$ 0,21/msg (utilidade) | grátis se o cliente inicia a conversa.

---

### Gerador de contratos white-label — liberar Saturnino e Coelho
**Objetivo:** confirmar com o escritório os 2 pontos em aberto antes de considerar o gerador deles pronto de vez (hoje `contrato_aprovado=true`, já visível pra qualquer usuário do tenant).

**O que fazer:**
1. Confirmar se a frase extra da Cláusula Sexta (Assinatura Digital) — presente só no modelo PF original — é intencional ou esquecimento no documento fonte deles.
2. Pegar logo/paleta oficial da Saturnino e Coelho (hoje usando a paleta neutra do `_starter`, com marcador `«TROQUE»`).
3. Se algum dos dois não fechar, revogar liberação em `/admin/empresas/a5a1c2d5-29d1-4564-86f1-0c6ac91f5b05` até resolver.

---

### White-label: módulos configuráveis
**Objetivo:** além de nome/logo, permitir ligar/desligar módulos por instância do CRM.

**O que fazer:**
1. Adicionar `modulos_ativos text[]` em `empresa_config`
2. Sidebar filtra itens conforme módulos ativos
3. Dashboard exibe KPIs só dos módulos ativos
4. Página de configurações com toggles de módulo (admin only)

**Ver:** `WHITE_LABEL.md` para mapa completo de módulos.

---

## Concluído

- Módulo financeiro: contas a pagar / receber com multi-moeda (BRL, USD, EUR, GBP, ARS)
- Contas a pagar: parcelamento no cartão de crédito
- Contas a pagar: conta recorrente com campo "Até" para limite de data
- Contas a pagar: filtro por mês vigente com toggle "Ver tudo"
- Contas a pagar: categoria Investimento
- Fornecedores com PIX + WhatsApp, vinculados a contas a pagar
- Cadastro inline de fornecedor dentro do formulário de conta a pagar
- Contas bancárias: campo PIX (tipo + chave copiável)
- Confirmação de pagamento/recebimento com seleção de conta bancária e preview de saldo
- KPI cards do financeiro filtrados ao mês vigente
- Preço real pago: campos multa e juros no registro de pagamento
- Automações: cron diário marcando contas vencidas como "atrasado" (pg_cron)
- Automações: página `/automacoes` com cards por categoria (Admin / Vendas) e botão "?"
- Follow-ups de e-mail: botão no card do pipeline, dialog D+3/D+7, widget no dashboard
- Gerador de contratos: motor compartilhado (`engine.js`) extraído do template da Aurum, reusável por qualquer tenant; gerador da Saturnino e Coelho construído a partir dos modelos reais deles
- Gerador de contratos: corrigido bug de produção em que o `engine.js` não carregava nos templates white-label (matcher do middleware gateava `.js` sob `/contratos/` por engano — cookie de sessão `SameSite=Lax` não vai em request cross-site do Storage)
- Admin > Relatórios de bug: dropdown de status não abria mais o card sozinho (bug de propagação de clique dentro do `<a>`); notificação por e-mail ao autor quando o report é marcado como resolvido; aba "Histórico de resolvidos" separada da lista ativa
