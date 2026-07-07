# Plano de Campanha — Google Ads (Busca) — CRM Studio

> Status: **plano pronto pra publicar**, com 7 bloqueadores de código/produto a resolver antes (Seção 0). Metodologia: `.claude/agents/google-ads.md`. Todo número de CPC/volume/conversão está **rotulado como estimativa** — nenhum vem de acesso direto ao Keyword Planner (exige conta Ads ativa); validar no Keyword Planner/Editor no momento de montar a campanha.

## Resumo executivo

| | |
|---|---|
| **Posicionamento** | Anti-planilha + horizontal ("qualquer negócio") + preço fixo por empresa |
| **Conversão a otimizar** | `trial_iniciado` (evento já especificado em `tracking-plano.md`) |
| **Valor de conversão sugerido** | R$ 297 (ticket do plano Pro — mesmo valor já usado no GA4) |
| **Campanha de lançamento** | 1 campanha Search, não-marca, match frase/exata |
| **CPA-alvo recomendado (partida)** | **R$ 150–190 por trial** (ver conta completa na Seção 6) |
| **Verba (TETO CONFIRMADO PELO DONO)** | **R$ 500/mês (~R$ 16/dia)** — ver ajuste obrigatório abaixo |
| **Meta mês 1 (com R$500)** | ~2–5 trials/mês; fase de validação, sinal mais lento (~8–10 semanas) |

> ### ⚠️ AJUSTE PARA R$ 500/MÊS (verba real confirmada — substitui a recomendação de R$3k acima)
> Com ~R$ 16/dia **não dá pra rodar 7 grupos** — a verba se dilui e nenhum grupo junta sinal. Escopo enxuto obrigatório:
> - **1 campanha, 1 grupo só** (no máx. 2): o de **maior intenção de compra**. Priorize `crm para pequena empresa` + `sistema de gestão de clientes` (frase/exata). Deixe os outros grupos (whatsapp, preço, financeiro, pipeline, "sair da planilha") **pausados** no roadmap — ligue um de cada vez só quando o CPA do primeiro validar.
> - **Lances:** Maximize Conversions (ou Manual CPC ~R$ 3–5 de teto) — NÃO tCPA (não vai juntar as ~15–30 conversões que o tCPA exige nesse orçamento).
> - **Expectativa honesta:** ~15–30 cliques/dia? Não. Com R$16/dia e CPC de CRM (~R$ 3–6 estimado), são **~3–5 cliques/dia** → poucas visitas → sinal lento. R$500 **valida** (a landing converte? o CPA é viável?), não escala. Se validar, aumentar a verba é o próximo passo — não adianta espalhar em muitas keywords antes disso.
> - **Negativas e message-match seguem iguais** (Seções abaixo). Use só as **2 melhores RSAs** do grupo escolhido.

---

## 0. Bloqueadores encontrados no código (resolver antes de publicar)

Auditoria rápida do site de marketing (`src/app/(marketing)/`) achou 7 pontos que **quebram o anúncio se não forem corrigidos primeiro** — message-match, tracking ou promessa que a landing não cumpre ainda:

| # | Bloqueador | Onde | Por quê importa |
|---|---|---|---|
| 1 | **Site diz "7 dias grátis" em 4 lugares, mas a oferta é 14 dias** | `hero.tsx:93`, `infinite-slider.tsx:14`, `social-proof.tsx:32`, `final-cta.tsx:66` | Anúncio promete 14 dias → landing mostra 7 → quebra confiança no clique nº1. Já mapeado em `docs/lancamento/landing-copy.md`. **Corrigir antes de gastar o primeiro real.** |
| 2 | **Não existe tracking de conversão instalado** (sem GA4/gtag/dataLayer no projeto) | todo o `src/` | Regra do playbook: **sem conversão rastreada, não rode.** Passo a passo completo já existe em `docs/lancamento/tracking-plano.md` — é pré-requisito, não deste doc. |
| 3 | **CTA do header aponta para `/login`, não `/cadastro`** | `site-header.tsx:57-62, 90-96` | Poluiu o funil de topo — quem clica no header não vira `iniciar_cadastro`. Padronizar para `/cadastro`. |
| 4 | **Vertical Engenharia está "Em breve"** na página de preços (`precos/page.tsx`, array `VERTICAIS`, `badge: 'Em breve'`) | `/precos` | Não é sellable ainda. **Não publicar** grupo de anúncio "CRM para Engenharia" prometendo plano vertical até esse card sair do ar — tráfego pago pronto pra comprar batendo em "em breve" é o pior tipo de desperdício de CPC. Fica no roadmap Fase 2 (Seção final). |
| 5 | **Hospedagem é `us-east-1` (EUA), não Brasil** | memória do projeto | Não afirmar "dados no Brasil" em nenhum callout/RSA — é claim falso e risco jurídico. Usar "criptografado, em conformidade com a LGPD" (sem citar país). |
| 6 | **Sem banner de consentimento de cookies (Consent Mode)** | `tracking-plano.md` Seção 4 | LGPD: coletar analytics sem consentimento antes do Ads gerar volume é o momento certo de resolver, não depois. |
| 7 | **Sem telefone/WhatsApp público em `/contato`** | `contato/page.tsx` | Não configurar extensão de chamada agora (não existe número pra usar) — usar só o sitelink "Fale com a gente". |

Os itens 1, 2 e 3 são **bloqueadores duros** — publicar a campanha sem eles é queimar verba medindo errado ou prometendo o que a página não entrega. Os itens 4-7 mudam o escopo/copy do plano abaixo (já ajustado para não pisar neles).

---

## 1. Keyword research PT-BR por intenção

Metodologia: fundo de funil primeiro (quem já sabe que quer um sistema), depois meio de funil. Todas as estimativas de **volume e CPC são rotuladas** — vieram de pesquisa de benchmarks de mercado (WebSearch), não do Keyword Planner. Fontes na Seção "Metodologia das estimativas" no final.

### Achado importante da pesquisa — não apostar cego em "planilha"

Termos como `planilha de controle de clientes` e `planilha de cadastro de clientes` têm **volume real relevante no Brasil**, mas a imensa maioria da primeira página é conteúdo (Agendor, InfinitePay, Hashtag Treinamentos etc.) oferecendo **planilha grátis pra baixar** — ou seja, quem busca isso majoritariamente quer o Excel de graça, não comprar um CRM. É a keyword mais arriscada da lista: alto volume, baixa intenção de compra. Por isso o grupo "Sair da Planilha" abaixo é pequeno, com match mais restrito e negativas reforçadas — a mensagem anti-planilha deve viver no **anúncio**, não ser a aposta principal de keyword.

### Tabela de volume/CPC estimado por grupo (Brasil, nacional — ESTIMATIVA)

| Grupo temático | Volume mensal estimado* | CPC estimado* | Prioridade |
|---|---|---|---|
| 1. CRM para Pequena Empresa | Médio (~800–2.000/mês somado) | R$ 6–12 | **Máxima** |
| 2. Sistema de Gestão de Clientes | Médio-Alto (~600–1.800/mês) | R$ 7–15 | **Máxima** |
| 3. CRM com WhatsApp | Médio (~400–1.000/mês) | R$ 6–12 | **Máxima** |
| 4. CRM Preço Fixo / Barato | Baixo-Médio (~250–700/mês) | R$ 4–9 | Alta |
| 5. CRM + Financeiro | Baixo (~100–350/mês) | R$ 5–10 | Alta |
| 6. Pipeline / Funil de Vendas | Baixo-Médio (~200–500/mês) | R$ 4–9 | Média |
| 7. Sair da Planilha (teste) | Baixo, difícil estimar (<150/mês) | R$ 3–8 | Baixa — teste controlado |

*\*ESTIMATIVA direcional — ordem de grandeza pra dimensionar verba, não número exato. O CPC-âncora vem do benchmark "Tecnologia/SaaS Brasil: R$ 7–18, média ~R$ 10" (agregado de agências BR, 2026) e "B2B Brasil: R$ 2,50–18,00 por setor". Termos genéricos e competitivos ("crm", "sistema de crm") tendem ao teto da faixa — concorrem com Salesforce, HubSpot, RD Station, Pipedrive, Agendor, Ploomes, todos anunciantes ativos no Brasil. Cauda longa qualificada tende ao piso. Confirmar no Keyword Planner antes de fixar lances.*

### Keywords por grupo (match frase/exata — sem ampla no início)

**Grupo 1 — CRM para Pequena Empresa** *(Final URL: `/`)*
- `crm para pequena empresa` — frase **e** exata
- `crm para pequenas empresas` — frase
- `crm para pme` — frase **e** exata
- `crm para pmes` — frase
- `sistema de crm para pequenas empresas` — frase
- `melhor crm para pequena empresa` — frase
- `crm para pequenos negócios` — frase
- `crm para microempresa` — frase

**Grupo 2 — Sistema de Gestão de Clientes** *(Final URL: `/produto`)*
- `sistema de gestão de clientes` — frase **e** exata
- `software de gestão de clientes` — frase
- `sistema de crm` — frase **e** exata
- `software de crm` — frase
- `programa de crm` — frase
- `programa para controlar clientes` — frase
- `sistema para controle de clientes` — frase

**Grupo 3 — CRM com WhatsApp** *(Final URL: `/`)*
- `crm com whatsapp` — frase **e** exata
- `crm integrado ao whatsapp` — frase
- `sistema de vendas com whatsapp` — frase
- `crm com whatsapp para pequena empresa` — frase **e** exata
- `gestão de clientes pelo whatsapp` — frase

**Grupo 4 — CRM Preço Fixo / Barato** *(Final URL: `/precos`)*
- `crm barato` — frase **e** exata
- `crm com preço fixo` — frase **e** exata
- `crm sem cobrar por usuário` — frase
- `crm mensalidade fixa` — frase
- `quanto custa um crm` — frase

**Grupo 5 — CRM + Financeiro** *(Final URL: `/produto`)*
- `crm com financeiro` — frase **e** exata
- `sistema de vendas e financeiro` — frase
- `crm com contas a pagar e receber` — frase
- `sistema de gestão comercial e financeiro` — frase

**Grupo 6 — Pipeline / Funil de Vendas** *(Final URL: `/produto`)*
- `sistema de funil de vendas` — frase
- `software de pipeline de vendas` — frase
- `gestão de funil de vendas` — frase
- `crm para funil de vendas` — frase **e** exata

**Grupo 7 — Sair da Planilha** *(experimental, Final URL: `/`)*
- `sistema para substituir planilha de clientes` — frase
- `crm para sair da planilha` — frase **e** exata
- `alternativa a planilha de clientes` — frase
- `controle de clientes sem planilha` — frase
> Orçamento tetado (não deixar competir por verba com os grupos 1-3). Revisar Search Terms deste grupo TODO dia na primeira semana — é o mais propenso a puxar buscas de "planilha grátis".

Não incluído nesta fase: `crm` sozinho (volume alto mas intenção difusa + concorrência de marca gigante = CPC no teto e cliques desqualificados), e termos informacionais (`o que é crm`, `para que serve crm` — meio de funil, não fundo).

---

## 2. Estrutura da campanha

Enxuta, seguindo o princípio "poucas keywords com verba real": **1 campanha para o lançamento**, verticais e marca ficam pra Fase 2 (ver roadmap no final) — orçamento de R$ 3.000/mês fatiado em 3 campanhas não gera sinal em nenhuma.

```
Campanha: CRM Studio | Busca | Não-Marca | BR
├─ Rede: Só Pesquisa (Display OFF, Search Partners OFF)
├─ Idioma: Português
├─ Local: Brasil — opção "Presença" (pessoas NO Brasil, não "interesse em" Brasil)
├─ Orçamento: R$ 100/dia
├─ Lance: Maximizar Conversões (sem tCPA travado nas primeiras 2-4 semanas)
├─ Final URL suffix (opcional, recomendado): utm_source=google&utm_medium=cpc&utm_campaign={_campaignname}&utm_term={keyword}&utm_content={adgroupid}
│
├─ GA1 - CRM Pequena Empresa      (prioridade máxima · Final URL /)
├─ GA2 - Gestão de Clientes        (prioridade máxima · Final URL /produto)
├─ GA3 - CRM WhatsApp              (prioridade máxima · Final URL /)
├─ GA4 - Preço Fixo                (prioridade alta · Final URL /precos)
├─ GA5 - CRM Financeiro            (prioridade alta · Final URL /produto)
├─ GA6 - Pipeline Vendas           (prioridade média · Final URL /produto)
└─ GA7 - Sair da Planilha (teste)  (prioridade baixa · Final URL /) — orçamento tetado
```

Distribuição de verba sugerida entre grupos (dentro do orçamento diário): ~60% nos 3 grupos de prioridade máxima (GA1-GA3), ~30% nos de prioridade alta (GA4-GA5), ~10% em GA6-GA7. Não definir orçamento por grupo de anúncio no Ads (não existe nativamente) — controlar via **lance por CPC manual mais alto** nos grupos prioritários se usar Maximizar Conversões não estiver distribuindo bem, ou observar e ajustar depois de 1-2 semanas de dados.

---

## 3. Palavras-chave negativas (nível de conta — subir no dia 1)

**Grátis / pirataria**
`grátis` · `gratis` · `gratuito` · `free` · `de graça` · `sem pagar` · `download` · `baixar` · `baixa` · `crackeado` · `crack` · `pirata` · `ativador` · `serial` · `licença grátis`

**Carreira / emprego**
`vaga` · `vagas` · `emprego` · `empregos` · `trabalhe conosco` · `currículo` · `salário` · `concurso`

**Educacional / informacional (fora do fundo de funil desta campanha)**
`curso` · `como criar` · `como fazer` · `tutorial` · `aprenda` · `apostila` · `pdf` · `ebook` · `o que é crm` · `para que serve`

**Combinações de "planilha" (protege os grupos 1-6 e restringe o grupo 7)**
`planilha grátis` · `planilha modelo` · `modelo de planilha` · `template planilha` · `planilha excel download` · `baixar planilha`

**Concorrentes — decisão explícita, não use sem pensar**
`salesforce` · `hubspot` · `pipedrive` · `rd station` · `ploomes` · `agendor` · `moskit` · `bitrix24` · `zoho` · `kommo` · `amocrm`
> Com match frase/exata (sem ampla) o risco de disparar em busca de marca concorrente é baixo, mas adicionar como negativa é a prática segura recomendada pelo playbook — **a menos que o dono decida rodar uma campanha de conquista de concorrente na Fase 2** (mensagem comparativa, CPA-alvo próprio, mais alto). Se topar isso depois, remover daqui e criar campanha dedicada.

**Específicas do Grupo 7 (Sair da Planilha)** — reforço, além das gerais acima:
`modelo` · `template` · `download` · `planilha grátis` (já coberto, mas reforçar no nível de grupo)

---

## 4. Anúncios (Responsive Search Ads) + extensões

2 RSAs por grupo prioritário (ângulos diferentes, pra testar), pinando só a keyword no Headline 1 (message-match). Grupos 4-7 podem reaproveitar o banco de headlines abaixo trocando o headline pinado pela keyword do grupo — mantém a mecânica sem reescrever do zero.

**Compliance:** nenhum claim absoluto/superlativo não comprovado; sem afirmar "hospedado no Brasil" (é `us-east-1`); "usuários ilimitados" só aparece em headlines/descriptions de grupos que citam Pro/Business — não usar em contexto que sugira valer pro Starter (limite de 3 usuários).

### Grupo 1 — CRM para Pequena Empresa

**RSA 1A — ângulo dor / anti-planilha**

Headlines (pin H1):
1. `[PIN1]` CRM para Pequena Empresa
2. Não Cabe Mais na Planilha
3. Saia da Planilha Hoje
4. Fim da Planilha Bagunçada
5. Substitua o Excel Hoje
6. Chega de Dado Perdido
7. Sem Planilha, Sem Retrabalho
8. 14 Dias Grátis, Sem Cartão
9. Comece Grátis Hoje Mesmo
10. Tudo em Um Só Lugar

Descriptions:
1. Troque a planilha por um sistema completo de vendas, financeiro e clientes.
2. 14 dias grátis, sem cartão de crédito. Comece a usar em 30 minutos.
3. Chega de dado perdido em planilha que ninguém atualiza. Tudo num só lugar.
4. Feito para qualquer negócio: comércio, serviços, advocacia e mais.

**RSA 1B — ângulo preço fixo / diferencial**

Headlines (pin H1):
1. `[PIN1]` CRM para Pequena Empresa
2. Preço Fixo por Empresa
3. Não Cobra por Usuário
4. Time Todo, Mesmo Preço
5. A Partir de R$ 147/mês
6. CRM Simples e Completo
7. Sistema para Qualquer Setor
8. Módulos por Setor de Atuação
9. 14 Dias Grátis, Sem Cartão
10. CRM Feito pra PME Brasileira

Descriptions:
1. Preço fixo por empresa, não por usuário. Adicione o time todo sem pagar mais.
2. Starter a partir de R$147/mês. Planos Pro e Business com mais módulos.
3. 14 dias grátis, sem cartão. Ative só os módulos que seu negócio precisa.
4. Vendas, financeiro e contratos num só sistema. Sem custo por usuário extra.

### Grupo 2 — Sistema de Gestão de Clientes

**RSA 2A — ângulo organização/funcionalidade**

Headlines (pin H1):
1. `[PIN1]` Sistema de Gestão de Clientes
2. Organize Toda a Operação
3. Cadastro em Menos de 30 Min
4. Gestão Completa de Clientes
5. Tudo sobre seu Cliente Aqui
6. Fim da Planilha Bagunçada
7. Sem Planilha, Sem Retrabalho
8. Histórico Completo de Cliente
9. 14 Dias Grátis, Sem Cartão
10. Sistema Feito pra PME

Descriptions:
1. Cadastro, histórico e pipeline de vendas num só sistema. Sem planilha paralela.
2. Cada cliente com histórico, contatos e negócios organizados automaticamente.
3. Fim da planilha bagunçada: toda a carteira de clientes num só lugar.
4. 14 dias grátis, sem cartão. Configure sua equipe em menos de 30 minutos.

**RSA 2B — ângulo preço + financeiro integrado**

Headlines (pin H1):
1. `[PIN1]` Sistema de Gestão de Clientes
2. CRM + Financeiro Juntos
3. Preço Fixo, Não por Usuário
4. O Caixa Fecha Sozinho
5. Venda Virou Conta a Receber
6. Comece Grátis, Sem Cartão
7. Sistema para Qualquer Setor
8. A Partir de R$ 147/mês
9. 14 Dias Grátis, Sem Cartão
10. CRM Feito pra PME Brasileira

Descriptions:
1. O negócio fechado já vira conta a receber. Sem redigitar nada em planilha.
2. Preço fixo por empresa, não por usuário. Starter a partir de R$147/mês.
3. 14 dias grátis, sem cartão de crédito. Preço fixo, sem surpresa na conta.
4. Funciona para qualquer negócio: comércio, serviços e mais setores.

### Grupo 3 — CRM com WhatsApp

**RSA 3A — ângulo atendimento/chat**

Headlines (pin H1):
1. `[PIN1]` CRM com WhatsApp Integrado
2. Atendimento no WhatsApp Certo
3. Nunca Mais Perca um Lead
4. Toda Conversa num Só Lugar
5. Fim do WhatsApp Pessoal
6. Equipe Responde sem Bagunça
7. Chat + Vendas + Financeiro
8. Histórico de Toda Conversa
9. 14 Dias Grátis, Sem Cartão
10. Comece Grátis Hoje Mesmo

Descriptions:
1. Centralize as conversas do WhatsApp da equipe, sem perder histórico de cliente.
2. Toda conversa do WhatsApp vira histórico do cliente, direto no pipeline.
3. 14 dias grátis, sem cartão de crédito. Configure em 30 minutos.
4. Preço fixo por empresa. Some usuários sem aumentar a mensalidade.

**RSA 3B — ângulo SDR com IA / automação** *(add-on — deixar claro que é add-on, não recurso do plano base)*

Headlines (pin H1):
1. `[PIN1]` CRM com WhatsApp Integrado
2. SDR com IA no WhatsApp
3. Um Vendedor de IA 24h
4. Qualifica Lead Sozinho
5. Venda Direto pelo WhatsApp
6. Leads Direto no Pipeline
7. Prospecção Automática 24h
8. Preço Fixo por Empresa
9. 14 Dias Grátis, Sem Cartão
10. CRM Feito pra PME Brasileira

Descriptions:
1. Adicione o SDR com IA: qualifica leads e joga direto no seu pipeline.
2. Agente de IA prospecta e qualifica no WhatsApp, 24 horas por dia.
3. 14 dias grátis, sem cartão. Teste o CRM com ou sem o SDR de IA.
4. Preço fixo por empresa. Some usuários sem aumentar a mensalidade.

> Grupos 4-7: montar 1 RSA cada reaproveitando os headlines/descriptions "Preço Fixo" e "14 dias grátis" acima, trocando o Headline 1 pinado pela keyword-âncora do grupo (ex.: GA4 pina "CRM com Preço Fixo"; GA6 pina "Sistema de Funil de Vendas"). Antes de publicar, contar caracteres de cada headline/description no editor do Google Ads — os limites (30/90) foram respeitados no draft, mas o editor é a fonte de verdade final.

### Extensões (nível de campanha)

**Sitelinks**
| Texto | Final URL | Descrição 1 | Descrição 2 |
|---|---|---|---|
| Ver Planos e Preços | `/precos` | Starter, Pro e Business | Preço fixo por empresa |
| Como Funciona | `/produto` | Pipeline, financeiro e mais | Veja todos os módulos |
| Comece Grátis | `/cadastro` | 14 dias, sem cartão | Cadastro em minutos |
| Fale com a Gente | `/contato` | Tire suas dúvidas | Atendimento em português |

**Callouts**
`Preço fixo por empresa` · `14 dias grátis` · `Sem cartão de crédito` · `Setup em 30 minutos` · `Suporte em português` · `Financeiro incluído` · `Módulos por setor`

**Snippet estruturado**
Cabeçalho **Tipos**: `Pipeline de vendas` · `Financeiro` · `Contratos` · `Chat WhatsApp` · `Estoque` · `RH`

**Chamada:** não configurar agora — não há telefone/WhatsApp público em `/contato` (Bloqueador #7).

---

## 5. Rastreamento de conversão

Especificação completa (evento, ponto de instalação, snippets) já existe em **`docs/lancamento/tracking-plano.md`** — não duplicar aqui, só a decisão relevante pro Ads:

- **Conversão primária:** `trial_iniciado` (dispara em `/cadastro/sucesso`, ver tracking-plano.md Seção 2.3).
- **Valor:** R$ 297 (ticket do plano Pro) — usado tanto na tag GA4 quanto no CPA-alvo deste doc, pra manter os dois documentos consistentes.
- **Caminho de importação:** GA4 → marcar `trial_iniciado` como evento-chave → Google Ads → Conversões → importar. Alternativa mais rápida pra Smart Bidding: tag `AW-` direta no mesmo ponto (tracking-plano.md Seção 3.2).
- **Pré-requisito duro:** isso precisa estar rodando e validado no GA4 DebugView/Realtime **antes** do primeiro real gasto — sem conversão instrumentada, "Maximizar Conversões" otimiza às cegas (na prática, gasta o orçamento sem aprender nada).

---

## 6. CPA-alvo (quanto pagar por trial)

### Fórmula

```
LTV do cliente pagante   = Ticket mensal × Margem × Meses de retenção
CAC-alvo (por pagante)   = LTV ÷ fator de segurança (regra LTV:CAC)
CPA-alvo (por TRIAL)     = CAC-alvo × Taxa de conversão trial → pago
```

O Google Ads otimiza por **trial** (evento `trial_iniciado`), não por cliente pagante — por isso o último passo desconta pela taxa de conversão trial→pago.

### Suposições explícitas (rotuladas — validar com dado real após alguns meses)

| Suposição | Valor usado | Fonte/justificativa |
|---|---|---|
| Margem bruta SaaS | 80% | Padrão informado; típico de SaaS madura — pode ser menor no início (suporte/infra pesam mais) |
| Meses de retenção (LTV) | **12 meses** (conservador) / 24 meses (otimista) | Sem dado de churn real ainda (produto novo) — 12m é o piso conservador pra não superestimar |
| Taxa trial → pago | **10%–20%** (faixa pedida) | Benchmark de mercado pesquisado: SaaS B2B geral 10-25% (mediana ~18,5%); **ferramentas de CRM especificamente ~29% em média** — a faixa 10-20% usada aqui é conservadora frente ao benchmark do próprio setor |
| Fator LTV:CAC | 3:1 (regra "saudável" de mercado) e 2:1/2,5:1 (fase inicial, land-grab) | 3:1 é o padrão de eficiência; early-stage aceita mais agressivo pra gerar sinal rápido |

### Sensibilidade — plano Pro (R$ 297, âncora — mesmo valor do GA4)

| Cenário | LTV | CAC saudável (÷3) | CPA-alvo trial @10% | CPA-alvo trial @20% |
|---|---|---|---|---|
| 12 meses retenção | R$ 2.851,20 | R$ 950,40 | **R$ 95,04** | **R$ 190,08** |
| 24 meses retenção | R$ 5.702,40 | R$ 1.900,80 | R$ 190,08 | R$ 380,16 |

### Ponto de atenção — a conta só fecha em certas combinações

Cruzando com o custo real de mercado (CPC ÷ taxa de conversão da landing): com CPC R$ 8 e landing convertendo 3% (faixa pedida: 2-4%), o custo real por trial fica em **~R$ 267**. Isso é **maior** que o CPA-alvo "saudável" (regra 3:1) no cenário mais conservador (R$ 95-190) — ou seja, **nos primeiros meses, com os números mais pessimistas, Google Ads pode não fechar a conta usando a regra estrita de 3:1**. A conta só destrava com folga se a taxa trial→pago ficar **acima de ~15%** ou a retenção passar de **18 meses** — ambos plausíveis (o benchmark do setor CRM aponta ~29% trial→pago), mas ainda não comprovados neste produto específico.

**Recomendação prática:** nos primeiros 60-90 dias, operar com fator LTV:CAC mais apertado (2,5:1 em vez de 3:1) pra não travar o canal antes de ter dado real — depois recalibrar com a taxa trial→pago **medida de verdade**.

### CPA-alvo recomendado para começar (fator 2,5:1, 12 meses, 15% trial→pago — ponto médio da faixa pedida)

| Plano | Ticket | CPA-alvo trial |
|---|---|---|
| Starter | R$ 147 | R$ 85 |
| **Pro (âncora)** | **R$ 297** | **R$ 171 → usar R$ 150–190 como faixa de partida** |
| Business | R$ 497 | R$ 286 |
| Advocacia (vertical, Fase 2) | R$ 247 | R$ 142 |

Como a campanha de lançamento é horizontal (gera trial de qualquer plano, não segmentado), **use R$ 150–190 por trial como tCPA de partida no Google Ads** (não trave ainda — comece em "Maximizar Conversões" sem limite, deixe o algoritmo achar o CPA real nas primeiras 2-4 semanas, e só then defina o tCPA numérico usando esse range como referência, ajustado pelo que a conta mostrar).

---

## 7. Verba recomendada

**Verba inicial: R$ 100/dia (~R$ 3.000/mês).**

Três ângulos que convergem pro mesmo número (triangulação, não chute):

1. **Via meta de conversões:** 15-30 trials/mês × CPA-alvo R$ 150-190 = **R$ 2.250 a R$ 5.700/mês**.
2. **Via cliques:** meta de 15-30 trials/mês ÷ taxa de conversão da landing (2-4%, meio 3%) = ~500-1.000 cliques/mês (17-33 cliques/dia) × CPC médio R$ 6-9 (grupos prioritários) = **R$ 3.000 a R$ 9.000/mês**.
3. **Via benchmark de mercado (BR, Tecnologia/SaaS):** fase de aprendizado R$ 2.500-4.000/mês, fase de escala R$ 4.000-8.000/mês (fonte: agregado de agências BR, rotulado como estimativa).

R$ 3.000/mês cai no meio dos três — suficiente pra gerar sinal sem apostar verba real num canal ainda não validado (conversão trial→pago real e CPC real são as duas incógnitas que só o próprio Ads vai revelar).

### O que esperar semana a semana

| Período | O que esperar | O que fazer |
|---|---|---|
| Semana 1-2 | Fase de aprendizado do algoritmo. CPA instável, pode vir 1,5-3x acima do alvo. Poucas conversões. | Não mexer em lance/orçamento. Revisar Search Terms **todo dia** e negativar lixo (principalmente variações de "planilha grátis"). |
| Semana 3-4 | CPA deve começar a convergir conforme acumula conversões (meta: 15-30 no total). | Ao bater ~15-30 conversões, migrar de Maximizar Conversões para **tCPA**, usando o CPA real observado (não só o teórico) como base. |
| Mês 2 | Se o CPA real ficar ≤ R$ 250-300 **e** a primeira leitura de trial→pago (mesmo direcional, cohort pequena) apontar ≥15%, escalar. Se CPA persistir > R$ 300-350 sem sinal de conversão trial→pago melhor, **não** aumentar verba — o problema é de funil (ativação/onboarding), não de mídia. | Dobrar a verba aos poucos (não de uma vez) se os números fecharem; senão, investigar landing/onboarding antes de gastar mais. |

---

## 8. Checklist "pronto pra publicar"

**Bloqueadores de produto/código (resolver primeiro — Seção 0):**
- [ ] Corrigir "7 dias" → "14 dias" em `hero.tsx`, `infinite-slider.tsx`, `social-proof.tsx`, `final-cta.tsx`
- [ ] Instalar tracking GA4 completo (`docs/lancamento/tracking-plano.md`) e confirmar disparo de `trial_iniciado` no DebugView
- [ ] Padronizar CTA do header (`site-header.tsx`) de `/login` para `/cadastro`
- [ ] Confirmar que NÃO se afirma "dados no Brasil" em nenhum callout/RSA (hospedagem é `us-east-1`)
- [ ] Banner de consentimento de cookies (Consent Mode v2) no ar
- [ ] Excluir/não publicar grupo "Vertical Engenharia" enquanto `badge: 'Em breve'` estiver ativo em `/precos`

**Conta e configuração do Google Ads:**
- [ ] Vincular GA4 ↔ Google Ads, marcar `trial_iniciado` como evento-chave, importar como conversão (valor R$ 297)
- [ ] Criar campanha: Só Pesquisa, Search Partners OFF, Display OFF
- [ ] Idioma Português, Local Brasil com opção "Presença"
- [ ] Orçamento R$ 100/dia, lance "Maximizar Conversões" (sem tCPA travado ainda)
- [ ] Final URL suffix com UTMs configurado a nível de conta/campanha

**Conteúdo:**
- [ ] Subir os 7 grupos de anúncio com keywords em frase/exata (nada em ampla)
- [ ] Subir negativas de conta (Seção 3) + negativas extras do Grupo 7
- [ ] Subir as 6 RSAs prontas (Seção 4) + montar RSA simples pros grupos 4-7 reaproveitando o banco de headlines
- [ ] Conferir cada headline (≤30 caracteres) e description (≤90 caracteres) no editor do Google Ads
- [ ] Subir sitelinks, callouts e snippet estruturado

**Pós-publicação:**
- [ ] Revisar Search Terms diariamente na 1ª semana, depois semanalmente
- [ ] Não tocar em lance/orçamento nos primeiros 7-10 dias
- [ ] Ao atingir 15-30 conversões: migrar para tCPA usando CPA real como referência

---

## Roadmap Fase 2 (não faz parte deste lançamento)

- **Vertical Advocacia** — campanha própria (`crm para advocacia`, `sistema para escritório de advocacia`), CPA-alvo R$ 142 (ver Seção 6), quando o volume da campanha principal justificar fatiar orçamento sem descapitalizar os grupos 1-3. Landing dedicada (`/advocacia`) aumentaria o message-match e reduziria CPC — hoje só existe seção dentro de `/produto`.
- **Vertical Engenharia** — bloqueada até o card sair de "Em breve" em `/precos`. Mesma lógica da Advocacia depois disso.
- **Campanha de Marca** (`crm studio`, `crmstudio`) — só faz sentido quando existir busca real pelo nome (orgânico, boca a boca, outros canais). CPC baixo, defensiva contra concorrente comprando sua marca.
- **Campanha de Conquista de Concorrentes** — mensagem comparativa direta ("alternativa ao Pipedrive/Agendor com preço fixo"), CPA-alvo mais alto (intenção mais quente, mas CPC também mais alto). Remover os nomes de concorrentes da lista de negativas (Seção 3) só quando decidir rodar isso.
- **Match amplo (ampla)** — só depois do tCPA maduro (Mês 2-3+), com histórico de conversão suficiente pro Smart Bidding não desperdiçar em queries irrelevantes.

---

## Metodologia das estimativas (fontes)

CPC Brasil (Tecnologia/SaaS, B2B geral): agregado de blogs de agências BR (2026) — witu.digital, andrerochaconsultor.com.br. CPC internacional B2B SaaS/Software: Kampaio ("B2B SaaS Google Ads Benchmarks 2026", ~US$5,34) e WordStream ("Google Ads Benchmarks 2025", Software ~US$3,88). Taxa trial→pago: agregadores de benchmark SaaS 2025 (10-25% geral, mediana ~18,5%, CRM especificamente ~29%). Taxa visita→trial: agregadores de benchmark SaaS 2025-2026 (mediana geral SaaS 3,8%; tráfego pago ~7,1% num agregador; B2B SaaS tradicional 1-3%, landing dedicada até 5%). Nenhum destes é dado direto do Google Keyword Planner (exige conta Ads ativa) — são ordem de grandeza pra planejar, não números finais. Validar CPC/volume reais no Keyword Planner e ajustar este documento no momento de montar a campanha.
