Revisão concluída. Investiguei a causa-raiz, o diff, o padrão pré-existente e as garantias de segurança. Veredito abaixo.

## Veredito: ✅ APROVADO — correção correta, completa e segura

### A causa-raiz está certa
A migration `20260703130000_protege_billing_empresas.sql` de fato faz `revoke update on public.empresas from authenticated` e dropa a policy `empresa_admin_update`. Isso confirma o ponto central do bug report: **não era só RLS, o próprio `GRANT UPDATE` foi revogado de propósito** — por isso o erro é `permission denied for table empresas` e não uma linha silenciosamente filtrada por RLS. A hipótese "adicionar uma policy de UPDATE" do prompt original teria sido a correção errada.

### A correção segue o padrão já estabelecido (não inventou nada)
As três funções corrigidas (`salvarDadosEmpresa`, `salvarEncarregado`, `toggleModuloVisibilidade`) foram alinhadas ao padrão que `salvarTimbrado`/`removerTimbrado`/`excluirConta` já usavam no mesmo arquivo: escrita em `empresas` via `createAdminClient()` (service-role), com escopo de tenant por `.eq('id', empresaId)`. Confirmei que **todos os demais acessos a `empresas` neste arquivo já usavam o admin client** — essas três eram, de fato, as únicas sobras. A correção é completa, não parcial.

### Não reabre o buraco de escalada de billing
Verifiquei o que cada função grava:
- `salvarDadosEmpresa`: `razao_social`, `nome_fantasia`, `cnpj`
- `salvarEncarregado`: `encarregado_*`
- `toggleModuloVisibilidade`: `modulos_ocultos`

Nenhuma toca colunas de billing (`modulos_ativos`, `trial_ends_at`, `valor_mensalidade`, `plano`, `status`). Importante: `modulos_ocultos` (visibilidade de UI) é diferente de `modulos_ativos` (entitlement pago) — a vulnerabilidade original era sobre `modulos_ativos`, então isso é cosmético e seguro. Re-conceder `GRANT UPDATE` teria reaberto a falha; a correção corretamente **não** mexe em RLS/GRANT.

### Autorização e escopo preservados
- `getAuthAdmin()` (auth.ts:92-95) redireciona qualquer não-admin antes da escrita — service-role não vira bypass de RBAC.
- `empresaId` vem do tenant *efetivo* e é aplicado em todo `.eq('id', empresaId)` — sem cross-tenant.
- `createClient` continua importado/usado (linhas 205, 763), então a remoção do destructuring de `supabase` nas três funções não deixa import órfão — sem quebra de lint/tsc.

### Nitpicks (não bloqueiam)
- Os comentários `GOTCHA billing` são bons e citam a migration — ótimo para o próximo dev.
- `build-1.md` e `review-1.md` são artefatos do agente anterior; provavelmente não deveriam ser commitados (mas isso é do processo, não da correção).

Nenhum bug encontrado. A correção resolve exatamente o problema reportado (salvar *nome fantasia*) e, de quebra, corrige `salvarEncarregado` e `toggleModuloVisibilidade`, que estavam quebrados pela mesma causa.
