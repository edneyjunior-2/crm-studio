# Landing Copy — CRM Studio (proposta pronta pra colar)

> **Status:** proposta de copy. NÃO altera código ainda. Cada bloco traz o texto final em PT-BR + o arquivo/linha exatos onde entra.
> **Ângulo mestre:** ANTI-PLANILHA. **Posicionamento:** horizontal (qualquer negócio) + verticais prontas. **Diferencial-âncora:** preço FIXO POR EMPRESA (não por usuário). **Oferta:** teste grátis 14 dias, sem cartão. **Conversão a otimizar:** trial iniciado / cadastro concluído (`/cadastro`).

---

## ⚠️ Antes de tudo: 3 inconsistências que quebram o message-match

O anúncio promete **14 dias**. O site inteiro diz **"7 dias"**. Isso derruba a confiança no momento do clique (a promessa do anúncio some na landing). Trocar em todos os pontos:

| Onde | Arquivo | Linha | Hoje | Corrigir para |
|---|---|---|---|---|
| Stat strip do hero | `src/components/marketing/hero.tsx` | 93 | `'7 dias grátis'` | `'14 dias grátis'` |
| Faixa infinita | `src/components/marketing/infinite-slider.tsx` | 14 | `'7 dias grátis · Setup em 30 min'` | `'14 dias grátis · Setup em 30 min'` |
| Prova social (stat) | `src/components/marketing/social-proof.tsx` | 32 | `value: 7 … suffix: ' dias'` | `value: 14` |
| Sub-garantia CTA final | `src/components/marketing/final-cta.tsx` | 66 | `7 dias grátis - sem cartão…` | `14 dias grátis · sem cartão · suporte em PT-BR` |

> Decisão de negócio: se o trial real é 7 e não 14, **o anúncio é que precisa mudar** — mas a instrução do dono fixou 14. Alinhar ANÚNCIO = HERO = SITE na mesma promessa, custe o que custar. Sem isso, todo o resto da copy perde eficácia.

---

## 1. HERO — `src/components/marketing/hero.tsx`

### 1.1 Badge (linha 41) — hoje: "Plataforma modular para PMEs brasileiras"

Manter conceito, mas puxar o gancho. Opções:

- **A (recomendada):** `Saia das planilhas — sem virar refém de sistema caro`
- **B:** `O fim da operação no Excel`
- **C:** `Para qualquer negócio que ainda roda no Excel`

### 1.2 Headline (linhas 47-60) — o gancho ANTI-PLANILHA

A headline hoje é `Organize toda a operação, do seu jeito.` — boa, mas não bate com o anúncio. A estrutura usa `<StaggerText>` em duas partes (a 2ª fica na cor de destaque). Cada opção abaixo já vem quebrada em **parte 1 (branca)** + **parte 2 (accent)** pra encaixar no componente sem mudar a mecânica.

- **Opção 1 (recomendada) — dor + destino**
  Parte 1: `Sua empresa não cabe mais`
  Parte 2 (accent): `na planilha.`

- **Opção 2 — comando direto (mais próxima do anúncio)**
  Parte 1: `Saia do Excel. Bote a operação`
  Parte 2 (accent): `pra rodar sozinha.`

- **Opção 3 — promessa profissional**
  Parte 1: `Troque as planilhas por um sistema`
  Parte 2 (accent): `que trabalha por você.`

- **Opção 4 — anti-caos**
  Parte 1: `Chega de planilha que ninguém`
  Parte 2 (accent): `atualiza.`

- **Opção 5 — horizontal explícito**
  Parte 1: `Todo o seu negócio organizado —`
  Parte 2 (accent): `fora da planilha.`

> Recomendação A/B: **Opção 1** (dor: a planilha "não escala") vs **Opção 2** (comando + benefício automação). Opção 1 costuma ganhar em público que já sente o limite; Opção 2 ganha em tráfego frio de anúncio de automação.

### 1.3 Subhead (linhas 64-68) — reforço HORIZONTAL + preço fixo por empresa

Hoje fala só de módulos. Reescrever pra carregar os dois diferenciais (serve pra qualquer negócio + preço por empresa):

- **A (recomendada):**
  `Tire vendas, financeiro, contratos e equipe da planilha e coloque num só lugar — pra qualquer tipo de negócio. Preço fixo por empresa: seu time cresce, a mensalidade não.`

- **B (mais curta):**
  `Um sistema só pra toda a operação — comercial, financeiro e contratos — que serve pra qualquer negócio. Você paga por empresa, não por usuário.`

- **C (foco automação):**
  `Automatize o que hoje mora em dez abas de Excel. Serve pra qualquer setor, tem versões prontas pra advocacia e engenharia, e o preço é fixo por empresa — adicione quantos usuários quiser.`

### 1.4 CTA primário (linha 78) — hoje: "Começar grátis"

Manter o botão como **`Começar grátis`** (curto converte). A promessa completa vai na stat strip logo abaixo, pra não poluir o botão.

- Botão: `Começar grátis`
- (opcional, microcopy no hover/aria — não obrigatório): `Começar grátis — 14 dias`

CTA secundário (linha 85): manter `Falar com a gente`.

### 1.5 Stat strip (linha 93) — a garantia que casa com o anúncio

Trocar de `['7 dias grátis', 'Sem cartão de crédito', 'Setup em 30 min']` para:

```
['14 dias grátis', 'Sem cartão de crédito', 'Preço fixo por empresa']
```

> Motivo: "Setup em 30 min" já aparece na seção Como Funciona e na faixa infinita. Aqui, no ponto de maior atenção, o 3º item deve carregar o diferencial de preço — a objeção nº1 ("é caro?") morre antes de nascer.

---

## 2. FAIXA INFINITA — `src/components/marketing/infinite-slider.tsx` (linhas 6-15)

Ajustar o array `ITEMS` pra reforçar anti-planilha + preço fixo (troca de 2 itens e o "7 dias"):

```ts
const ITEMS = [
  'Saia das planilhas de vez',
  'Tudo num só lugar, sem duplicar dado',
  'CRM para qualquer tipo de empresa',
  'Ative só o que a sua operação precisa',
  'Comercial · Financeiro · Contratos · RH',
  'Preço fixo por empresa — não por usuário',
  'Versões prontas: advocacia e engenharia',
  '14 dias grátis · Setup em 30 min',
]
```

---

## 3. PROVA SOCIAL / NÚMEROS — `src/components/marketing/social-proof.tsx`

> **⚠️ Honestidade obrigatória.** Não há métrica de clientes/receita real fornecida. Os "números" atuais são **atributos do produto** (100% integrado, R$0 de setup, 30 min, trial) — isso é legítimo e NÃO é dado inventado. Manter esse formato. **Não** inserir "+500 empresas", "R$X faturados" ou estrelas sem fonte real.

### 3.1 Citação (linhas 52-54)

Hoje é uma citação genérica atribuída à própria "Equipe CRM Studio" — honesto, mas fraco. Duas rotas:

- **Rota A — manter placeholder, mas com gancho anti-planilha (recomendada até ter depoimento real):**
  > `"A gente vivia perdido em planilha que ninguém atualizava. Agora vendas, financeiro e contratos estão no mesmo lugar — e o caixa fecha sozinho no fim do mês."`
  Rodapé: `Depoimento ilustrativo — substituir por cliente real no lançamento` *(deixar comentário no código; NÃO publicar como se fosse cliente real)*

- **Rota B — assumir a voz da marca, sem fingir depoimento:**
  > `"Construímos o CRM Studio pra tirar a PME brasileira da planilha — toda a operação num lugar só, com preço que não pune o crescimento."`
  Rodapé: `CRM Studio`

> **AÇÃO PARA O DONO:** trazer **1 frase real** do primeiro cliente (advocacia) ou da Aurum. Um depoimento real com nome + empresa vale mais que qualquer copy. Placeholder marcado até lá.

### 3.2 Grid de números (linhas 6-35) — manter estrutura, refinar labels

Trocar o 4º card (trial) pra 14 dias e ajustar o 1º pra ancorar no anti-planilha e no preço fixo:

| # | value/suffix | label | sub |
|---|---|---|---|
| 1 | `100%` | `da operação num lugar` | `vendas, financeiro e contratos sem planilha paralela` |
| 2 | `R$ 0` | `de setup` | `começa a funcionar no mesmo dia, sem consultoria` |
| 3 | `30 min` | `para estar no ar` | `da conta criada ao primeiro registro no sistema` |
| 4 | `14 dias` | `de teste grátis` | `sem cartão de crédito para começar` |

> Ideia forte (opcional, se o dono topar): trocar o card 3 por **`1` … `mensalidade por empresa` … `adicione usuários sem pagar a mais`** — transforma a seção de números no argumento de preço. Requer só mudar o objeto `STATS`.

---

## 4. FEATURES POR BENEFÍCIO — `src/components/marketing/features-grid.tsx`

A grade hoje é excelente em cobertura, mas descreve **funcionalidade** ("Pipeline de vendas", "Financeiro integrado"). O pedido é virar a chave pra **benefício** (o que você ganha ao sair do Excel). Estratégia: **manter os cards e ícones**, reescrever `title` + `desc` do grupo "Para todo negócio" no eixo do ganho. Verticais ficam como estão (já vendem bem por especificidade).

### 4.1 Cabeçalho da seção (linhas 191-199)

- H2 (recomendada):
  Parte branca: `Tudo o que hoje vive em dez abas de Excel —`
  Parte muted: `num sistema só.`
- Subtexto:
  `Cada funcionalidade resolve uma dor da planilha: dado que se perde, conta que ninguém lançou, informação que só existe na cabeça de uma pessoa. Ative o que faz sentido pro seu setor e pague por empresa, não por usuário.`

### 4.2 Grupo "Para todo negócio" (linhas 28-73) — títulos por benefício

| Ícone (manter) | title HOJE | title NOVO (benefício) | desc NOVA |
|---|---|---|---|
| TrendingUp | Pipeline de vendas | **Nenhuma venda esquecida numa aba** | Funil visual de arrastar e soltar no lugar da planilha de follow-up: cada oportunidade com etapa, valor e histórico. Você vê o que vai fechar sem abrir dez arquivos. |
| Landmark (accent) | Financeiro integrado | **O caixa fecha sozinho** | Contas a pagar e a receber conectadas à venda. A negociação que fecha já vira dinheiro previsto no caixa — sem redigitar nada em outra planilha. |
| MessageSquare | Chat Inbox · WhatsApp | **O atendimento não some no WhatsApp pessoal** | Toda conversa por cliente, num só lugar, com histórico. A equipe inteira responde sem misturar com o celular de ninguém — e nada se perde quando alguém sai. |
| Users | Clientes e relacionamentos | **A carteira inteira num só lugar** | Histórico, contatos e atividades por cliente, com busca automática de CNPJ. Fim da lista de contatos espalhada em três planilhas diferentes. |
| CalendarDays | Agenda e atividades | **Nenhum compromisso perdido** | Tarefas, reuniões e lembretes sincronizados com o Google Calendar de cada pessoa. O que era anotação solta vira agenda que cobra você. |
| FileSignature | Contratos | **Contrato pronto, com a sua marca** | Gera contratos white-label a partir dos seus modelos e já cadastra o cliente. O que levava uma tarde de copiar-e-colar sai em minutos. |
| Package | Estoque e operações | **Estoque que bate com a realidade** | Produtos, saldo e movimentações ligados às operações. Chega de contar no olho e conferir numa planilha desatualizada. *(Add-on no Pro, incluso no Business.)* |
| Bot | SDR WhatsApp · IA | **Um vendedor de IA trabalhando 24h** | Agente de IA que prospecta, qualifica e joga o lead direto no seu funil — sem você mexer numa planilha de leads. *(Add-on em qualquer plano.)* |

> Nota de CRO: o card **Financeiro** já é `accent: true` (destaque visual). Perfeito — é o benefício mais forte contra planilha ("o caixa fecha sozinho"). Manter o realce.

### 4.3 Verticais (linhas 75-128)

Manter como estão. Sugestão leve: no `sub` de cada grupo, colar o preço da vertical pra ancorar valor:
- Advocacia (linha 77): `Escritórios e departamentos jurídicos. Plano vertical a partir de R$ 247/mês.`
- Engenharia (linha 104): `Construção civil e gestão de obras. Plano vertical a partir de R$ 347/mês.`

---

## 5. COMO FUNCIONA — `src/components/marketing/how-it-works.tsx` (linhas 8-27)

Boa como está. Ajuste fino pra reforçar "sair da planilha" no passo 1 e o preço no fecho:

- Título (linha 60): manter `Três passos para estar no ar`.
- Subtítulo (linha 63): `Da planilha ao sistema rodando em menos de 30 minutos.`
- Passo 01 desc: `Cadastre sua equipe e defina o acesso de cada área. Sem planilha de onboarding, sem consultor, sem configuração complexa.`
- Passo 02 desc: manter (já está bom).
- Passo 03 desc: `Todas as áreas conectadas. O que acontece em vendas já aparece no financeiro — zero dupla digitação, zero planilha paralela.`

---

## 6. OBJEÇÕES — SEÇÃO NOVA (não existe hoje)

> **Recomendação de estrutura:** criar uma seção `<Objecoes />` e inseri-la no `page.tsx` **entre `<FinancialSpotlight />` e `<SocialProof />`** (após a linha 35). É o ponto onde o visitante já entendeu o valor e começa a levantar as travas. Formato: 4 cards de FAQ (accordion ou grid), estética igual aos cards de feature.

**Título da seção:** `"Tá, mas e o meu caso?"`
**Subtítulo:** `As perguntas que todo mundo faz antes de largar a planilha.`

### Objeção 1 — "E a minha planilha atual?"
**Pergunta:** `Vou perder tudo o que já está na planilha?`
**Resposta:** `Não. Você importa seus clientes e negócios da própria planilha (CSV/Excel) na hora do cadastro — a gente ajuda no primeiro import. Nada é digitado de novo, e sua planilha continua sua enquanto você testa. Migrar leva minutos, não semanas.`

### Objeção 2 — "Serve pro meu setor?" (horizontal + verticais)
**Pergunta:** `Isso funciona pro tipo de negócio que eu tenho?`
**Resposta:** `O núcleo — vendas, financeiro, contratos e clientes — serve pra qualquer empresa que vende e cobra. Em cima disso, você ativa módulos por setor: já existem versões prontas pra advocacia (processos, prazos) e engenharia (obras, orçamento SINAPI), e outras áreas com estoque, RH e mais. Você monta a combinação do seu negócio.`

### Objeção 3 — "É caro?" (preço fixo por empresa + trial)
**Pergunta:** `Quanto custa? Vai encarecer quando meu time crescer?`
**Resposta:** `Preço fixo por empresa, a partir de R$ 147/mês — não por usuário. Coloque o time inteiro que a mensalidade não muda. Comece pelo teste grátis de 14 dias, sem cartão: se não fizer sentido, é só não continuar.`
*(microcopy opcional embaixo: `Starter R$147 · Pro R$297 · Business R$497 — todos por empresa, usuários ilimitados no plano.`)*

### Objeção 4 — "Meus dados estão seguros?" (LGPD/segurança)
**Pergunta:** `E a segurança dos meus dados e dos meus clientes?`
**Resposta:** `Seus dados ficam isolados dos de qualquer outra empresa, criptografados e hospedados no Brasil. O CRM Studio é construído em conformidade com a LGPD, com controle de acesso por perfil — cada pessoa vê só o que precisa. Você exporta ou apaga seus dados quando quiser.`

> **Verificar antes de publicar:** confirmar com o dono a afirmação "hospedados no Brasil" (região do Supabase é `aws-1-us-east-1` pela memória do projeto → **é EUA, não Brasil**). Se a hospedagem é US-East, **trocar** por: `armazenados com criptografia em infraestrutura de nuvem de padrão internacional, em conformidade com a LGPD.` Não afirmar Brasil se não for verdade — é exatamente o tipo de claim que queima confiança (e é risco jurídico).

---

## 7. CTA FINAL — `src/components/marketing/final-cta.tsx`

### 7.1 H2 (linhas 39-42) — hoje: "Comece a organizar seu negócio hoje."

- **Opção 1 (recomendada, fecha o loop anti-planilha):**
  Parte branca: `Feche a planilha.`
  Parte accent: `Abra o CRM Studio.`
- **Opção 2:**
  Parte branca: `Sua última semana`
  Parte accent: `no Excel.`
- **Opção 3 (manter tom atual, mais suave):**
  Parte branca: `Tire seu negócio da planilha`
  Parte accent: `hoje.`

### 7.2 Subtexto (linhas 43-46)
`14 dias grátis pra colocar toda a operação no lugar. Sem cartão, sem instalação, sem consultor. Preço fixo por empresa quando você continuar.`

### 7.3 Botões
- Primário (linha 53): `Começar grátis` (manter).
- Secundário (linha 60): `Falar com a gente` (manter).

### 7.4 Sub-garantia (linha 66) — hoje: "7 dias grátis - sem cartão - suporte em PT-BR"
`14 dias grátis · sem cartão · suporte em português`

---

## 8. METADATA / SEO — `src/app/(marketing)/page.tsx` (linhas 10-14)

Alinhar o title/description com a promessa do anúncio (também melhora CTR na busca):

- **title:** `CRM Studio · Saia das planilhas e organize todo o seu negócio`
- **description:** `CRM brasileiro para PMEs: tire vendas, financeiro, contratos e equipe do Excel e coloque num sistema só. Preço fixo por empresa, versões prontas pra advocacia e engenharia. Teste grátis 14 dias, sem cartão.`

---

## Resumo de arquivos a mudar na implementação

| Bloco | Arquivo | Linhas |
|---|---|---|
| Hero: badge, headline, subhead, stat strip | `src/components/marketing/hero.tsx` | 41 · 47-60 · 64-68 · 93 |
| Faixa infinita | `src/components/marketing/infinite-slider.tsx` | 6-15 |
| Features (cabeçalho + grupo "todo negócio" + subs de vertical) | `src/components/marketing/features-grid.tsx` | 28-73 · 77 · 104 · 191-199 |
| Como funciona | `src/components/marketing/how-it-works.tsx` | 8-27 · 63 |
| Objeções (**seção nova**) | novo `src/components/marketing/objecoes.tsx` + `src/app/(marketing)/page.tsx` | inserir após linha 35 |
| Prova social (números + citação) | `src/components/marketing/social-proof.tsx` | 6-35 · 52-57 |
| CTA final | `src/components/marketing/final-cta.tsx` | 39-46 · 66 |
| Metadata | `src/app/(marketing)/page.tsx` | 10-14 |

## Pendências que dependem do dono (não são copy — são fatos a confirmar)
1. **Trial é 7 ou 14 dias?** A instrução diz 14; o site diz 7. Alinhar anúncio + site.
2. **Depoimento real** de cliente (advocacia/Aurum) pra substituir o placeholder da prova social.
3. **Hospedagem no Brasil?** Memória indica Supabase em `us-east-1` (EUA). Ajustar o texto de LGPD se não for BR.
4. **"Import de planilha" existe no cadastro?** A objeção 1 promete importar CSV/Excel. Confirmar que a feature existe (ou está no roadmap de lançamento) antes de prometer.
</content>
</invoke>
