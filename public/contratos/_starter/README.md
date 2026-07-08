# Gerador de Contratos — scaffold para tenant novo

Este diretório é o ponto de partida pra dar a **qualquer tenant do CRM Studio**
um gerador de contrato próprio (PDF client-side, preview ao vivo, editor de
cláusulas, histórico) sem duplicar o motor de ~1000 linhas. O motor
(`engine.js`) é compartilhado e vive em `public/contratos/engine.js` — este
`index.html` só declara **marca + campos + texto de cláusula**.

## Como usar

1. Copie `index.html` deste diretório para onde o tenant vai servir a página
   (ex: `public/contratos/<slug-do-tenant>/index.html`, ou faça upload pro
   Supabase Storage se for um template white-label servido via signed URL).
2. Troque tudo marcado com **«TROQUE»** no arquivo: paleta CSS (`:root`),
   nome/logo na sidebar, lista de campos do formulário, `TIMBRADO_DATA_URI`,
   `DEFAULT_CONTRACT_BLOCKS` (texto real do contrato) e o objeto
   `window.CONTRATO_CONFIG`.
3. Não toque no `<script src="https://app.crmstudio.com.br/contratos/engine.js?v=1">`
   — é o motor compartilhado. Se o `engine.js` for atualizado com uma mudança
   que quebra compatibilidade, suba a versão no `?v=`.

## `window.CONTRATO_CONFIG` — o que cada chave faz

Declarada **antes** do `<script src=".../engine.js">`, é a única ponte entre
o HTML do tenant e o motor.

| Chave | Obrigatória? | O que é |
|---|---|---|
| `timbradoDataUri` | não (mas sem ela o PDF sai sem papel timbrado) | Imagem de fundo do PDF em base64 (`data:image/jpeg;base64,...`), tamanho A4 (210×297mm). |
| `contractModels` | sim | `{ chave: { storageKey, blocks } }` — um modelo por aba. `storageKey` é onde as edições de cláusula ficam no `localStorage`; `blocks` é o array de cláusulas padrão (`DEFAULT_CONTRACT_BLOCKS`). |
| `defaultMode` | não (default `'pj'`) | Modo inicial do formulário: `'pj'` ou `'pf'`. |
| `documentPrefix` | não | Usado no nome do PDF exportado: `Contrato_Parceria_<documentPrefix>_<nome>.pdf`. |
| `minutaFileName` | não | Nome do arquivo gerado pelo botão "Minuta de Contrato" (rascunho genérico, sem dados da contraparte). |
| `minutaModelKey` | não | Força a Minuta a usar sempre um modelo específico (chave de `contractModels`), independente da aba ativa. Se omitido, usa o modelo selecionado no momento. |
| `historyKey` | não (default `'contrato_hist_v2'`) | Chave do `localStorage` onde o histórico de contratos gerados fica salvo. Dê uma chave própria por tenant pra não misturar histórico entre marcas diferentes rodando no mesmo domínio. |
| `clausulasFilePrefix` | não (default `'contrato'`) | Prefixo do arquivo JSON quando o usuário exporta as cláusulas pelo editor. |
| `brandName` | não | Só aparece em textos de confirmação da UI (ex: "restaurar padrão da [marca]?"). Omitido = texto genérico. |
| `email` | não | `{ subjectPrefix, companyName, signerName, signerCompany, phone, website }` — monta o assunto/corpo do botão "Enviar por E-mail" (mailto). Omitido = botão funciona, mas com texto vazio. |

## Tipos de bloco (cláusulas)

Cada item de `DEFAULT_CONTRACT_BLOCKS` é `{ type, text, mode? }`:

| `type` | Renderização no PDF |
|---|---|
| `h1` | Título centralizado, negrito, maior (ex: nome do contrato) |
| `h2` | Subtítulo de cláusula, negrito, alinhado à esquerda (ex: "CLÁUSULA PRIMEIRA...") |
| `p` | Parágrafo normal, justificado à esquerda |
| `right` | Bloco alinhado à direita (usado pra "Cidade, data") |
| `sign` | Linha de assinatura (desenha uma linha horizontal + texto centralizado embaixo) |

`mode: 'pj'` ou `mode: 'pf'` faz o bloco aparecer só naquele modo. Sem `mode`,
o bloco aparece nos dois.

## Sintaxe de placeholder `{{CAMPO}}` e grupo condicional `[...]`

- `{{NOME_DO_CAMPO}}` é substituído pelo valor do `data-field="NOME_DO_CAMPO"`
  do formulário. Se o campo estiver vazio, o PDF de preview mostra
  `{{NOME_DO_CAMPO}}` literalmente (pra avisar que falta preencher); na
  Minuta genérica, vira uma linha `__________` pra preencher à mão.
- `[texto opcional {{CAMPO}}]` — colchetes marcam um **grupo condicional**:
  se o usuário **desativar** (botão ✕ ao lado do campo) qualquer
  `{{CAMPO}}` que apareça dentro do grupo, o grupo inteiro some do texto
  final (útil pra frases tipo "e RG nº {{REP_RG}}" que só fazem sentido se o
  RG foi preenchido).

## Nomes de campo com comportamento especial (convenção do motor)

O motor (`engine.js`) tem lógica **genérica mas fixa** pros seguintes nomes
de campo — se você os usar, ganha a automação de graça; qualquer outro nome
funciona normalmente, só sem a automação:

- `PF_SEXO` → flexiona automaticamente `PF_ESTADO_CIVIL`, `PF_INSCRITO`,
  `PF_DOMICILIADO`, `PF_DENOMINADO` e `PF_NACIONALIDADE` (quando =
  "brasileiro") para o feminino.
- `COMISSAO_PCT` → gera `COMISSAO_EXT` (número por extenso, ex: "dez") e
  mostra um hint ao vivo ao lado do campo.
- `DATA_ASSINATURA` → gera `DATA_ASSINATURA_EXT` ("08 de julho de 2026")
  automaticamente.
- `PARCEIRO_RAZAO`, `PARCEIRO_CNPJ`, `PARCEIRO_ENDERECO`, `REP_CARGO`,
  `REP_NOME`, `REP_NACIONALIDADE`, `REP_CPF`, `REP_RG`, `PF_NOME`,
  `PF_NACIONALIDADE`, `PF_ESTADO_CIVIL`, `PF_PROFISSAO`, `PF_CPF`, `PF_RG`,
  `PF_ENDERECO` → são os campos que a "Minuta de Contrato" zera
  automaticamente (ela mantém timbrado/condições comerciais, mas apaga tudo
  que identifica a contraparte).

## Modo PJ / PF

Os botões `#btn-modo-pj` / `#btn-modo-pf` alternam a classe `mode-pj` /
`mode-pf` no `<body>`. Campos dentro de `.pj-only` só aparecem no modo PJ;
`.pf-only`, só no PF. Blocos de cláusula com `mode: 'pj'`/`'pf'` seguem a
mesma regra no PDF. Se o seu contrato só tem um tipo de contraparte, é só
não usar o toggle e não marcar `mode` nos blocos — tudo aparece sempre.

## ⚠️ NÃO MEXA: protocolo `postMessage` com o CRM

Ao exportar um PDF, o motor dispara:

```js
window.parent.postMessage({ type: 'aurum_contrato_gerado', entry, parceiro }, '*')
```

O nome `'aurum_contrato_gerado'` é **histórico** (nasceu com o template da
Aurum) mas hoje é o protocolo **genérico** que todo template de contrato usa
pra avisar o CRM Studio (React, em
`src/components/crm/contratos/contratos-view.tsx`) que um PDF foi gerado —
o lado React faz `if (e.data?.type !== 'aurum_contrato_gerado') return`.

**Não renomeie essa string em nenhum template**, mesmo parecendo
"Aurum-specific" — renomear quebra a integração (salvar/cadastrar) pra
qualquer tenant, não só a Aurum. Se um dia isso for revisitado, é uma
mudança coordenada em `engine.js` **e** no lado React, não algo pra decidir
por tenant.

O listener de entrada (`{ type: 'contrato_carregar', dados }`, que o CRM usa
pra reabrir um contrato salvo pra edição) já é genérico — nada a fazer aí.
