# Blusk Leads

Plataforma web **mobile-first**, em português, para freelancers e estúdios criativos:
**encontrar clientes reais → abordar com mensagem pronta → acompanhar no CRM → (em breve) entregar projetos e aprender**.

> Estado atual: **Fase 1 (MVP de prospecção) implementada e testada.**
> Proposta e decisões de arquitetura: [`docs/00-proposta-inicial.md`](docs/00-proposta-inicial.md) e [`docs/01-decisoes-fase-1.md`](docs/01-decisoes-fase-1.md).

## O que já funciona

| Área | Funcionalidades |
|---|---|
| Conta | Cadastro com senha (scrypt), confirmação de e-mail, login, recuperação de senha, consentimentos registrados, sair de todos os aparelhos |
| Onboarding | 4 telas: o que vende, nichos aceitos/excluídos (padrão: exclui advocacia), região, estilo de mensagem + "sobre você" |
| Busca | Nicho + cidade (autocomplete), 5 filtros por oferta com regra transparente, progresso em tempo real, ação em lote (enviar ao CRM / descartar) |
| Dados | Provedor trocável (`LeadProvider`): **Google Places API (New)** oficial em produção; provedor de dados **FICTÍCIOS** só em dev/testes |
| Regras de lead | Deduplicação por conta, **exclusividade de 30 dias** entre contas, nichos excluídos, empresas bloqueadas, negócios fechados |
| Score 0–100 | Regras configuráveis com **recibo** (cada regra, pontos e motivo; a soma fecha com a nota), etiqueta quente/morno/frio, painel de pesos |
| Mensagens | 3 variações de WhatsApp + e-mail + roteiro de ligação; **só fatos verificáveis** (verificador recusa número/preço/promessa inventados); opção "SAIR" sempre; IA (Claude) opcional com modelo seguro de reserva |
| WhatsApp | Link oficial `https://wa.me/55DDDNUMERO?text=...` com envio **manual**. Nenhum disparo automático |
| CRM | Kanban com arrastar e soltar (mouse, toque e teclado) + seletor "Mover para", visão em lista, filtros, etapas renomeáveis, histórico completo, motivo obrigatório em "Perdido", cadência de follow-up (+3/+5/+7 configurável), notas, etiquetas, valor estimado |
| Hoje | Follow-ups vencidos primeiro, leads quentes não contatados, números da conta |
| Créditos | Extrato imutável e idempotente; reserva na busca e **estorno automático** do que não foi entregue; busca com erro custa zero; teste grátis de 5 leads sem cartão (Brasil todo, sem escolher cidade) |
| LGPD | Política de Privacidade, Termos, **Remover minha empresa** (bloqueio imediato e global), exportação dos dados (JSON) e exclusão da conta |
| Admin | Ajuste de créditos com motivo obrigatório, plano do usuário, fila de remoções (desfazer abuso), uso de APIs, buscas com erro, auditoria |
| Segurança | **Row Level Security real** no Postgres, limites de requisição, cabeçalhos de segurança, chaves só no servidor, sem dados pessoais em log |

Abas "Projetos" e "Aprender" já existem na navegação e mostram o que vem nas próximas fases.

## Como rodar

Requisitos: Node 20+ e PostgreSQL 15+ (local, Supabase, Neon…).

```bash
npm install
cp .env.example .env          # ajuste DATABASE_URL
npm run db:migrate            # cria tabelas, RLS e funções
npm run db:seed               # opcional: conta demo@blusk.local / demo12345 (100 créditos, admin)
npm run dev                   # http://localhost:3000
```

Em desenvolvimento, os e-mails (confirmação, senha) aparecem em **http://localhost:3000/dev/emails**.

### Testes

```bash
npm test            # unitários + integração com banco (usa TEST_DATABASE_URL ou blusk_test local)
npm run test:e2e    # Playwright no celular emulado (usa E2E_DATABASE_URL ou blusk_e2e local)
npm run lint && npm run typecheck && npm run build
```

Cobertura atual: **41 testes unitários/integração** (score e recibo, telefone, link do WhatsApp, filtros, nichos, verificador de mensagens, todos os casos de cobrança e estorno, deduplicação, exclusividade, corrida entre buscas simultâneas, isolamento RLS entre contas, CRM, remoção de empresa) e **3 testes de ponta a ponta** (cadastro → busca → mensagem → WhatsApp → CRM → persistência → saldo; isolamento entre contas por URL; remoção de empresa).

## Variáveis de ambiente

| Variável | Obrigatória | Para quê |
|---|---|---|
| `DATABASE_URL` | sim | Postgres. O usuário precisa poder criar o papel `blusk_app` na primeira migração |
| `APP_URL` | sim | URL pública (links de e-mail) |
| `LEAD_PROVIDER` | sim | `google_places` em produção; `fake` só em dev/teste (bloqueado em produção) |
| `GOOGLE_PLACES_API_KEY` | produção | Chave da Places API (New), restrita por IP/servidor |
| `PROVIDER_DAILY_CALL_LIMIT` | não | Teto diário de chamadas ao provedor somando todas as contas (padrão 500) |
| `ANTHROPIC_API_KEY` | não | Liga a IA nas mensagens. Sem ela, usa o modelo determinístico (também só com fatos reais) |
| `AI_MODEL` | não | Padrão `claude-opus-5-5` |
| `RESEND_API_KEY`, `EMAIL_FROM` | produção | E-mail transacional |
| `CRON_SECRET` | produção | Protege `/api/cron/maintenance` (agendado a cada 10 min em `vercel.json`) |
| `ADMIN_EMAILS` | não | E-mails que viram administradores ao se cadastrar |

## Arquitetura em 30 segundos

```
Celular (PWA) ─▶ Next.js 15 (App Router, Server Actions)
                   │  withUser(): SET LOCAL ROLE blusk_app + app.user_id  ─▶  Postgres com RLS
                   │  sql(): papel dono (só auth, busca, créditos, admin)
                   ├─▶ LeadProvider ─▶ Google Places API (New) | FakeProvider (dev)
                   ├─▶ Claude (opcional) ─▶ verificador de fatos ─▶ mensagem
                   └─▶ after(): busca roda em segundo plano; tela acompanha por /api/searches/:id
```

- `db/migrations/` — esquema versionado (RLS, função `app.credit_apply`, restrição de exclusão para reservas).
- `src/lib/search/run.ts` — pipeline de busca e cobrança (reserva → entrega → estorno).
- `src/lib/score/` — regras e recibo.
- `src/lib/ai/` — fatos verificáveis, verificador, modelo seguro e IA.
- `src/app/(app)/` — telas logadas; `src/app/(public)/` — site, login, páginas legais e remoção.

## Decisões que tomei sem você (revise quando puder)

Resumo; detalhes em [`docs/01-decisoes-fase-1.md`](docs/01-decisoes-fase-1.md).

1. **Postgres puro + autenticação própria** em vez de depender do Supabase Auth: roda em qualquer Postgres (inclusive Supabase) e a RLS é testada de verdade.
2. **Hospedagem sugerida:** Vercel + Postgres gerenciado (Supabase ou Neon).
3. **IA:** Claude (`claude-opus-5-5`, esforço baixo), opcional. Recusa ou erro da IA cai no modelo seguro.
4. **Remoção de empresa é aplicada na hora** (privacidade primeiro); o admin pode desfazer pedidos abusivos.
5. **Dados do Google** têm prazo de validade (`expira_em`, 30 dias): renovados ao abrir o lead e limpos se não estiverem em nenhum lead. **Precisa de validação jurídica.**
