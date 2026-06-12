# CRM Aurum — Mapa de Integrações

Pesquisa aprofundada sobre integrações viáveis para o CRM Aurum. Atualizado em 2026-05-18.

---

## Resposta direta: NFS-e em Salvador-BA

**Sim, é possível emitir nota fiscal direto pelo CRM**, sem abrir o site da prefeitura.

Salvador migrou para o padrão nacional NFS-e em dezembro de 2025. O hub **Focus NFe** e o **NFe.io** já suportam Salvador (código IBGE 2927408).

### O que é necessário:
1. **Certificado Digital A1** (arquivo `.pfx`) — e-CNPJ A1, ~R$ 200-350/ano, renovar anualmente
2. **Inscrição Municipal ativa** em Salvador + ISS em dia
3. **Conta no hub** (Focus NFe, NFe.io, etc.) com API Key

### Comparativo de provedores:

| Provedor | Plano entrada | Volume | Salvador | SDK JS | Recomendação |
|---|---|---|---|---|---|
| **Focus NFe** | R$ 89,90/mês | 100 NFs, 3 CNPJs | ✅ | ✅ | Melhor custo-benefício para começar |
| **NFe.io** | R$ 190/mês | 250 NFs | ✅ | ✅ | Docs excelentes, escala melhor |
| **PlugNotas** | Consultar | +1.600 municípios | ✅ | ✅ | Foco em software houses, suporte 0800 |
| **Nuvem Fiscal** | R$ 360/mês (anual) | Consultar | ✅ | ✅ | SDK OpenAPI robusto |
| **eNotas** | R$ 137/mês | 50 NFs | ✅ | ✅ | Popular para PJs digitais |

**Escolha recomendada:** Focus NFe para começar (trial 30 dias grátis, sem fidelidade).

### Fluxo no CRM (como ficaria):
```
Negócio fechado → botão "Emitir NFS-e" → form preenche automaticamente
dados do cliente + serviço + valor → API Focus NFe → NF emitida e enviada
por e-mail ao cliente → PDF disponível no CRM
```

---

## Top 5 Integrações por Impacto

### 1. Asaas — Cobrança PIX + Boleto automático
**Impacto:** eliminar o processo manual de emitir cobranças

- Cliente fecha negócio → CRM gera cobrança no Asaas → cliente recebe PIX/boleto por e-mail
- Webhook: pagamento confirmado → status atualiza automaticamente no CRM
- **Custo:** sem mensalidade, R$ 0,99-1,99 por transação recebida
- **Complexidade:** baixa — REST API bem documentada
- Docs: `https://docs.asaas.com`

### 2. NFS-e via Focus NFe / NFe.io
**Impacto:** emitir nota fiscal direto do CRM, fim do acesso manual ao site da prefeitura

- **Custo:** R$ 89-190/mês
- **Complexidade:** média (precisa configurar certificado A1)
- Docs Focus: `https://focusnfe.com.br` | NFe.io: `https://nfe.io/docs`

### 3. Google Calendar
**Impacto:** atividades e reuniões do CRM sincronizam com a agenda da equipe

- Criar reunião no pipeline → aparece no Google Calendar do responsável
- **Custo:** gratuito
- **Complexidade:** média (OAuth 2.0)
- SDK: `npm install googleapis`

### 4. ZapSign — Assinatura digital de contratos
**Impacto:** enviar proposta para assinatura sem imprimir/escanear

- Negócio em proposta → gera link de assinatura → cliente assina pelo celular
- Validade jurídica plena (Lei 14.063/2020)
- **Custo:** R$ 79,90/mês (900 documentos/ano)
- **Complexidade:** baixa-média
- Docs: `https://zapsign.co`

### 5. WhatsApp Business API
**Impacto:** notificações de pipeline, follow-up e cobranças via WhatsApp

- Proposta enviada → WhatsApp automático → follow-up D+3/D+7 por WhatsApp
- **Custo:** ~R$ 0,21/msg (utilidade) | ~R$ 0,35/msg (marketing) | grátis se cliente inicia
- **Complexidade:** média-alta (verificação conta Meta Business, templates aprovados)
- Recomendado entrar via BSP: Twilio, Zenvia ou SocialHub na primeira fase

---

## Mapa completo por categoria

### Financeiro / Cobrança

| Integração | Provedor | Custo | Complexidade |
|---|---|---|---|
| PIX + Boleto automático | **Asaas** | Pay-per-use (~R$1/tx) | Baixa |
| Cartão de crédito / recorrência | Asaas, Iugu, Stripe | 1,99-2,9% por transação | Baixa |
| Link de pagamento | Asaas, Mercado Pago | Grátis no Asaas | Baixa |
| Conciliação bancária (Open Finance) | Pluggy, Belvo | Consultar | Alta |

### Fiscal

| Integração | Provedor | Custo | Complexidade |
|---|---|---|---|
| NFS-e (nota de serviço) | Focus NFe, NFe.io, PlugNotas | R$ 89-190/mês | Média |
| NF-e (nota de produto) | Mesmos hubs | Incluso nos planos | Média |
| CT-e (transporte) | Mesmos hubs | Incluso | Não relevante |

### Comunicação

| Integração | Provedor | Custo | Complexidade |
|---|---|---|---|
| E-mail transacional | **Resend** (já nas pendências) | Grátis até 3k/mês | Baixa |
| WhatsApp Business API | Meta Cloud API / Twilio / Zenvia | Por mensagem | Média-Alta |
| Gmail sync (histórico de e-mails) | Google Gmail API | Grátis | Média |
| Outlook sync | Microsoft Graph API | Grátis | Média |
| SMS | Zenvia, Twilio | ~R$ 0,25/SMS | Baixa |

### Assinatura Digital

| Integração | Custo | Validade jurídica | Complexidade |
|---|---|---|---|
| **ZapSign** | R$ 79,90/mês | ✅ Lei 14.063/2020 | Baixa-Média |
| ClickSign | R$ 149/mês | ✅ | Média |
| DocuSign | US$25+/usuário/mês | ✅ ICP-Brasil | Alta + caro |

### Calendário / Produtividade

| Integração | Custo | Complexidade |
|---|---|---|
| **Google Calendar** | Grátis | Média |
| Outlook Calendar | Grátis | Média |
| Slack (notificações) | Grátis (webhooks) | Baixa |
| Microsoft Teams | Grátis (webhooks) | Baixa |

### ERP / Contabilidade

| Integração | Como conectar | Custo | Complexidade |
|---|---|---|---|
| Omie | API REST ou via Pluga | Pluga: R$ 49+/mês | Baixa (Pluga) |
| Conta Azul | API REST ou via Pluga | Pluga: R$ 49+/mês | Baixa |
| Bling | API REST | Grátis (na conta Bling) | Média |
| SAP | Webhooks/middleware | Alto | Alta — não priorizar |

### BI / Relatórios

| Integração | Custo | Complexidade |
|---|---|---|
| **Metabase** (self-hosted no Railway) | Grátis | Média (conecta direto ao Supabase) |
| Google Looker Studio | Grátis | Baixa |
| Google Sheets export | Grátis (API Sheets v4) | Baixa |
| PowerBI embedded | US$20+/usuário/mês | Alta — não priorizar |

---

## Priorização para implementação

| Prioridade | Integração | Custo/mês | Complexidade | Sprint sugerido |
|---|---|---|---|---|
| P1 | **Asaas** (PIX + Boleto) | ~R$ 0-50 | Baixa | 1-2 |
| P1 | **NFS-e** (Focus NFe) | R$ 89,90 | Média | 3-4 |
| P2 | **Google Calendar** | Grátis | Média | 5 |
| P2 | **ZapSign** (contratos) | R$ 79,90 | Baixa-Média | 5-6 |
| P3 | **Resend** e-mail | Grátis | Baixa | já em PENDENCIAS.md |
| P3 | **WhatsApp API** | Por mensagem | Média-Alta | Pós-MVP |
| P4 | Gmail/Outlook sync | Grátis | Média | Pós-MVP |
| P4 | **Metabase** BI | Grátis | Média | Pós-MVP |
| P5 | Open Banking (Pluggy) | Consultar | Alta | Não priorizar agora |
| P5 | DocuSign / ClickSign | Alto | Alta | ZapSign resolve |

---

## O que NÃO vale a pena agora

- **Open Banking / conciliação bancária** — fluxo OAuth com banco complexo demais, benefício baixo para 4 usuários
- **DocuSign** — caro demais (US$10k-50k de setup API); ZapSign resolve por R$80/mês
- **PowerBI embedded** — requer licença Premium US$20+/usuário; Metabase self-hosted resolve de graça
- **SAP** — fora da escala de PME
- **NF-e de produto** — empresa de serviços emite NFS-e, não NF-e de produto

---

## Próximos passos para ativar NFS-e (Salvador)

1. Obter certificado digital A1 (e-CNPJ) — ~R$300, leva 1-3 dias úteis
2. Criar conta no Focus NFe (trial 30 dias grátis)
3. Configurar inscrição municipal de Salvador no painel do hub
4. Implementar no CRM: botão "Emitir NFS-e" no card do negócio fechado
5. Armazenar o `.pfx` do certificado de forma segura (Supabase Storage privado ou variável de ambiente encriptada — NUNCA expor via NEXT_PUBLIC)

---

*Última atualização: 2026-05-18*
