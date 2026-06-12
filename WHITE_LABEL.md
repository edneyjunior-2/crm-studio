# CRM Aurum — Estratégia White Label

Documento estratégico para guiar a transformação do CRM Aurum em produto vendável como white label.

---

## Visão Geral

O CRM Aurum foi construído para um caso específico: representação comercial multi-solução.
O objetivo deste documento é mapear quais partes são genéricas (vendáveis para qualquer empresa) e quais são específicas (precisam ser opcionais ou configuráveis), e definir o caminho para vender o produto a outras empresas.

---

## Mapa de Módulos

### Core — sempre ativo, não pode desligar

| Componente | O que faz |
|---|---|
| Auth + RBAC | Login, roles (admin/sócio/comercial), controle de acesso |
| Dashboard | KPIs dinâmicos — exibe apenas dados dos módulos ativos |
| Configurações | Usuários, empresa (nome, logo), módulos ativos |
| Clientes | Cadastro de clientes, enriquecimento de CNPJ, território |

---

### Módulos opcionais (ligar/desligar por empresa)

#### M1 — Pipeline de Vendas
**Para quem:** qualquer empresa que tenha processo de prospecção e fechamento de negócios.

| Feature | Status |
|---|---|
| Kanban com estágios | ✅ implementado |
| SLA por etapa (alerta de negócio parado) | ✅ implementado |
| Motivo de perda obrigatório | ✅ implementado |
| Follow-ups D+3/D+7 | ✅ implementado |
| Taxa de conversão por etapa | ✅ implementado |
| Estágios configuráveis pelo admin | ❌ a implementar |

**Empresas que NÃO precisam:** escritórios que só gerenciam clientes ativos, sem processo de prospecção.

---

#### M2 — Soluções / Produtos
**Para quem:** empresas que representam múltiplos produtos/soluções de terceiros e precisam associar cada negócio a uma solução específica.

| Feature | Status |
|---|---|
| Catálogo de soluções representadas | ✅ implementado |
| Comissão percentual por solução | ✅ implementado |
| Filtro de clientes por solução | ✅ implementado |

**Empresas que NÃO precisam:** empresas que vendem um único produto/serviço próprio. Para elas, este módulo pode ser substituído por um campo simples "Tipo de serviço" no negócio.

**Renomear para white label:** "Produtos", "Serviços", "Linhas", conforme o segmento do cliente.

---

#### M3 — Financeiro Básico
**Para quem:** empresas que precisam controlar o que vão receber e o que precisam pagar.

| Feature | Status |
|---|---|
| Contas a receber (com multi-moeda) | ✅ implementado |
| Contas a pagar (com parcelamento e recorrência) | ✅ implementado |
| Contas bancárias com saldo calculado | ✅ implementado |
| Alerta de contas vencendo hoje | ✅ implementado |
| Automação de marcação de contas atrasadas (pg_cron) | ✅ implementado |

**Empresas que NÃO precisam:** empresas que usam ERP/sistema contábil próprio e só querem o CRM para vendas.

---

#### M4 — Comissões
**Para quem:** empresas que pagam comissão variável para equipe de vendas ou parceiros externos.

| Feature | Status |
|---|---|
| Comissões para colaboradores internos | ✅ implementado |
| Comissões para parceiros externos (com PIX/banco) | ✅ implementado |
| Visão de comissões por comercial | ✅ implementado |

**Dependência:** requer M3 (Financeiro) ou M1 (Pipeline). Pode funcionar isolado como módulo de "folha variável".

---

#### M5 — Parceiros Comerciais
**Para quem:** empresas que trabalham com parceiros/indicadores/revendas e precisam controlar quem prospecta o quê.

| Feature | Status |
|---|---|
| Cadastro de parceiros com dados de pagamento | ✅ implementado |
| Bloqueio de território por CNPJ (pública 90d / privada 30d) | ✅ implementado |
| Proteção de carteira — aviso de CNPJ já prospectado | ✅ implementado |

**Empresas que NÃO precisam:** empresas com equipe interna de vendas sem parceiros externos.

---

#### M6 — Automações
**Para quem:** empresas que querem reduzir trabalho manual com notificações e ações automáticas.

| Feature | Status |
|---|---|
| Marcar contas atrasadas automaticamente (cron diário) | ✅ implementado |
| Alerta de follow-up pendente | ✅ implementado |
| Página de automações com cards explicativos | ✅ implementado |
| Envio de e-mail via Resend | ❌ a implementar (PENDENCIAS.md) |
| Alerta de conta vencendo D-3 | ❌ a implementar |
| Relatório financeiro semanal | ❌ a implementar |
| Negócio parado no pipeline | ❌ a implementar |

---

## Perfis de Empresa — Quem Compra o Quê

### Perfil 1 — Empresa de Representação Comercial (= Aurum)
*Representa múltiplos produtos de terceiros, tem equipe de vendas + financeiro.*

| Módulo | Ativo |
|---|---|
| Core (Clientes, Auth, Dashboard) | ✅ |
| Pipeline de Vendas | ✅ |
| Soluções / Produtos | ✅ |
| Financeiro Básico | ✅ |
| Comissões | ✅ |
| Parceiros Comerciais | ✅ |
| Automações | ✅ |

---

### Perfil 2 — Empresa Foco Total em Vendas
*Startup, distribuidora, time comercial B2B. Quer só o funil e os clientes.*

| Módulo | Ativo |
|---|---|
| Core | ✅ |
| Pipeline de Vendas | ✅ |
| Soluções / Produtos | opcional |
| Financeiro Básico | ❌ |
| Comissões | ✅ (pagar equipe) |
| Parceiros Comerciais | ❌ |
| Automações | ✅ (básicas) |

---

### Perfil 3 — Escritório / Consultoria Financeira
*Controle de recebíveis e pagamentos é o core, pipeline é secundário.*

| Módulo | Ativo |
|---|---|
| Core | ✅ |
| Pipeline de Vendas | opcional (simples) |
| Soluções / Produtos | ❌ |
| Financeiro Básico | ✅ |
| Comissões | ✅ (honorários de sócios) |
| Parceiros Comerciais | ✅ (indicadores) |
| Automações | ✅ |

---

### Perfil 4 — Freelancer / Prestador Individual
*Controle de clientes, projetos e o que vai receber. Equipe de 1-2 pessoas.*

| Módulo | Ativo |
|---|---|
| Core | ✅ |
| Pipeline de Vendas | ✅ (simples) |
| Soluções / Produtos | ❌ |
| Financeiro Básico | ✅ |
| Comissões | ❌ |
| Parceiros Comerciais | ❌ |
| Automações | básicas |

---

## Arquitetura White Label — Opções

### Opção A — Deploy separado por cliente (recomendada para começar)

**Como funciona:**
- Cada cliente = fork do repositório + deploy próprio no Vercel + banco Supabase próprio
- Configuração via tabela `empresa_config` + variáveis de ambiente

**Vantagens:**
- Simples de operar
- Isolamento total de dados (cada cliente no próprio banco)
- Customização fácil por cliente
- Sem risco de vazamento entre clientes

**Desvantagens:**
- Multiplica deployments: 10 clientes = 10 projetos no Vercel
- Atualizações precisam ser aplicadas em cada instância separadamente

**Custo estimado por cliente:**
- Vercel Hobby: grátis até 100GB bandwidth
- Supabase Free: grátis até 500MB banco / 50k usuários
- Custo real: **R$ 0 para clientes pequenos**, ~R$ 80-200/mês para clientes maiores

---

### Opção B — SaaS multi-tenant (para quando tiver 10+ clientes)

**Como funciona:**
- Um único deploy
- Tabela `tenants` + `tenant_id` em todas as tabelas
- RLS por `tenant_id`

**Vantagens:**
- Uma única base de código para manter
- Atualizações chegam para todos os clientes ao mesmo tempo
- Escala bem

**Desvantagens:**
- Complexidade muito maior de implementar
- Requer refatoração de todas as queries e RLS policies
- Vazamento de dados entre tenants é um risco que precisa de muito cuidado

**Conclusão:** começar com Opção A, migrar para B quando houver 10+ clientes pagantes.

---

## O que Falta Implementar para Vender White Label

### Prioridade 1 — Identidade Visual (White Label de verdade)

- [ ] Tabela `empresa_config` com `nome_empresa`, `logo_url`
- [ ] Upload de logo no Supabase Storage (bucket `logos`)
- [ ] Página `/configuracoes` com formulário de identidade visual
- [ ] Sidebar/Navbar lendo `empresa_config` via SSR — exibir logo ou nome da empresa
- [ ] Favicon configurável

### Prioridade 2 — Módulos Ligáveis/Desligáveis

- [ ] Campo `modulos_ativos: text[]` em `empresa_config`
- [ ] Sidebar filtrando itens conforme módulos ativos
- [ ] Dashboard mostrando KPIs só de módulos ativos
- [ ] Página de configurações com toggles de módulo (admin only)

### Prioridade 3 — Onboarding

- [ ] Fluxo de primeiro acesso: "Bem-vindo! Configure o nome da sua empresa e logo"
- [ ] Wizard para selecionar quais módulos ativar
- [ ] Usuário admin criado no setup inicial (sem precisar ir ao Supabase)

### Prioridade 4 — Operacional para Revenda

- [ ] Script de setup de nova instância (criar banco Supabase, rodar migrations, configurar env)
- [ ] Documentação de como fazer deploy de uma nova instância em 30 minutos
- [ ] Checklist de entrega ao cliente

---

## Renomeações Previstas por Segmento

Algumas labels da UI são específicas para representação comercial e precisam ser configuráveis:

| Label atual | Pode ser chamado de |
|---|---|
| Soluções | Produtos, Serviços, Linhas, Contratos |
| Negócios | Projetos, Oportunidades, Propostas |
| Responsável | Vendedor, Gestor, Consultor |
| Parceiros | Indicadores, Revendas, Afiliados |

**Implementação futura:** campo `label_customizado` por módulo em `empresa_config`.

---

## Próximos Passos Imediatos

1. Implementar identidade visual (nome + logo) — já está em PENDENCIAS.md como "White-label"
2. Implementar `modulos_ativos` em `empresa_config` + sidebar dinâmica
3. Criar script de deploy de nova instância
4. Definir precificação (ex: R$ 300/mês por instância com até 5 usuários)

---

*Última atualização: 2026-05-18*
