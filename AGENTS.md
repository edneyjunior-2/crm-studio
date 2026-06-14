<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# CRM Studio — contexto para agentes

CRM SaaS multi-tenant (PT-BR). Stack: **Next.js 16 (App Router) + React 19 + TypeScript + Base UI (`@base-ui/react`, NÃO shadcn/Radix — usa `render`, sem `asChild`) + Tailwind v4 + Supabase**.

Antes de codar, leia `CLAUDE.md` (deste diretório) e o `CLAUDE.md` da raiz do projeto (`/Users/edneyjunior/Documents/CRM-STUDIO/CLAUDE.md` — fonte de verdade) para stack, RBAC, schema do banco e convenções (auth em `src/lib/auth.ts`, Zod em `src/lib/schemas.ts`, BRL via `Intl.NumberFormat` pt-BR, datas sem `.toISOString()`, Base UI Select dentro de Dialog).
