# PRODUCT.md — CRM Aurum

## Product Purpose

Internal CRM for Aurum Tax Advisory, a Brazilian tax and accounting firm that represents multiple third-party SaaS solutions to their client base. The product manages the commercial operation: solution portfolio, client relationships, sales pipeline, financial tracking (accounts receivable/payable), and team calendar with Google Meet integration.

## Register

product

## Users

- **Edney (admin)**: owner, full access to all modules including financials and settings
- **Sócios (2)**: full access except settings; see full pipeline and financials
- **Comercial (1)**: restricted to own clients and deals; no financial access

Team is small and technical — 4 people total. Everyone uses it daily for prospecting, follow-up, and deal tracking.

## Brand

**Aurum Tax Advisory** — the name means gold in Latin. Brand palette:

| Name | OKLCH | Feel |
|---|---|---|
| Precisão | `oklch(0.14 0.006 200)` | Near-black, dark teal |
| Patrimônio | `oklch(0.295 0.068 211)` | Deep teal — primary |
| Reserva | `oklch(0.69 0.058 75)` | Warm gold/bronze — accent |
| Transparência | `oklch(0.92 0.006 270)` | Soft lavender-white |

**Typography**: NEXA (body), Libre Baskerville (headings). Brazilian Portuguese throughout.

**Tone**: Professional, precise, trustworthy. Not playful. Not cold. The brand evokes accuracy and financial stewardship — like a well-run office, not a startup.

## Anti-references

- Generic SaaS dashboards (white + blue + bold number cards)
- Overly decorative or complex UI (this is a daily work tool)
- Dark mode as default (the team works in offices with ambient light)
- English labels or UI copy

## Design Principles

1. **Clarity over decoration** — every element serves a task
2. **Brand colors used purposefully** — primary teal for primary actions/anchor elements, gold/bronze as supporting accent, never both competing at the same time
3. **Familiar patterns** — standard navigation, standard form controls, standard modals; no invented affordances
4. **Density when needed** — tables, lists, and data panels should be dense enough to scan, not padded out for appearance
5. **Portuguese first** — all copy, labels, toasts, and empty states in PT-BR
