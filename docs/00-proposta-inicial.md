# Blusk Leads — Proposta inicial (Fase 0: antes de qualquer código)

> Status: **aguardando aprovação**. Nada aqui foi implementado. Tudo marcado como **A DEFINIR** depende de resposta sua.

---

## (a) Perguntas em aberto

### Bloqueantes para a Fase 1 (sem elas não dá para começar)

1. **Provedor de dados e orçamento.** Confirma a **Google Places API (New)**? Qual o teto de gasto mensal (em US$) que posso usar como trava automática? Já existe conta no Google Cloud com faturamento ativo?
2. **Armazenamento de dados do Google (risco jurídico, ver Riscos R1).** Os termos do Google Maps Platform permitem guardar o `place_id` sem prazo, mas restringem guardar o restante do conteúdo (nome, telefone, nota etc.). Como o CRM precisa mostrar esses dados por meses, escolha uma opção:
   - **(A)** Guardar só o `place_id` e buscar os detalhes de novo quando o lead for aberto (mais chamadas de API, mais custo, 100% dentro dos termos);
   - **(B)** No momento em que o usuário **envia o lead para o CRM**, os dados passam a ser "dados do usuário" (ele confirma/edita), e a gente guarda essa cópia. Precisa de validação jurídica sua;
   - **(C)** Usar outro provedor com licença explícita para armazenar (ex.: base pública de CNPJ da Receita Federal combinada com Places só para nota/avaliações). Quer que eu pesquise provedores e custos?
3. **Provedor de IA.** Posso usar a API da Anthropic (Claude) para score explicável e mensagens? Orçamento mensal de IA?
4. **Hospedagem.** Confirma **Vercel** (front + API) + **Supabase** (Postgres, Auth, Storage)? Plano gratuito no início ou já pago?
5. **Domínio.** Qual domínio (ex.: blusk.com.br)? Já está registrado? Existe pedido de marca "Blusk" no INPI?
6. **E-mail transacional.** Qual remetente/serviço (Resend, Amazon SES, Postmark)? O domínio precisa de SPF/DKIM.
7. **Identidade visual.** Existe logo e cor de destaque? Se não, posso propor uma paleta neutra com um único destaque e você aprova.
8. **Teste grátis.** Quantos leads (sugestão do texto: 5)? Limite de 1 teste por e-mail **e** por telefone verificado, ou só por e-mail? (Só e-mail é fácil de burlar.)
9. **Login social.** Quais provedores (Google? Apple?) ou só e-mail e senha na Fase 1?
10. **Conta individual ou equipe?** Afeta o modelo de dados desde o início. Minha sugestão: modelar `workspaces` já agora (1 usuário = 1 workspace na Fase 1), para não precisar migrar depois.

### Necessárias até a Fase 2

11. **Gateway de pagamento:** Asaas, Mercado Pago ou Stripe? Precisa de Pix recorrente (Pix Automático) ou Pix avulso por ciclo basta?
12. **Planos:** nomes, preço mensal, preço anual, cota de créditos de cada um, parcelamento do anual (quantas vezes, com ou sem juros).
13. **Bônus de conversão em 24 h:** quantos créditos?
14. **Créditos extras avulsos:** pacotes e preços.
15. **Regiões fora do Brasil:** que fração da cota cada modalidade pode usar por ciclo? Como identificar "brasileiros no exterior" com dados reais? (O Google não diz a nacionalidade do dono. Proposta honesta: o usuário busca em cidades do exterior por termos em português, ex. "brazilian restaurant", e o sistema não afirma que o dono é brasileiro.)
16. **Exclusividade de 30 dias:** em cidades pequenas, o Google devolve no máximo ~60 resultados por consulta; com vários usuários no mesmo nicho/cidade o estoque acaba rápido. Mantém 30 dias fixos ou quer limitar por plano?
17. **Prazo de tolerância** para falha de pagamento (dias)?
18. **Tempo máximo aceitável** de uma busca (critério de aceite, ex.: 20 s para 20 leads)?

### Podem esperar (Fases 3 e 4)

19. Trilhas e aulas: já existem? Vídeos hospedados onde (YouTube não listado, Vimeo, Bunny, Mux)?
20. Comunidade entra no lançamento ou fica para depois? (Sugiro depois.)
21. Templates de proposta em PDF: o usuário sobe a própria logo e cor, certo?

### Perguntas de produto que mudam regra (respostas curtas bastam)

22. **"Potencial para vídeo e motion":** a Places API **não informa** se o negócio tem vídeo. Aceita que a regra use só sinais disponíveis (tem site, tem rede social no campo de site, nota boa, bastante avaliação, categoria visual como restaurante/estética/imobiliária)? Ou autoriza **ler só a página inicial do site público** do negócio para detectar vídeo incorporado (YouTube/Vimeo) e links de redes sociais? Isso é leitura pontual de site próprio da empresa, não do Google, mas quero sua aprovação.
23. **E-mail público:** o Google não fornece e-mail. Sem a leitura do site (pergunta 22), o campo e-mail ficará quase sempre "não disponível". Ok?
24. **MEI e autônomos:** o telefone de um MEI muitas vezes é o celular pessoal do dono (dado pessoal pela LGPD). Aceita a base legal de **legítimo interesse** com teste de balanceamento documentado e opt-out em toda mensagem?

---

## (b) Arquitetura proposta

**Resumo em um parágrafo.** Um app **Next.js (App Router, TypeScript)** hospedado na **Vercel**, mobile-first e instalável como PWA, fala com um **PostgreSQL no Supabase** protegido por **Row Level Security** (cada linha de dado de usuário pertence a um `workspace_id`). Toda operação sensível — buscar leads, cobrar créditos, chamar a IA, gerar link de WhatsApp com mensagem — passa por **rotas de servidor** (Server Actions / Route Handlers) que guardam as chaves e aplicam limites de requisição. A busca de leads é um **job assíncrono**: o usuário pede, o servidor **reserva** os créditos, um worker consulta o `LeadProvider` (Google Places na v1), filtra bloqueados, nichos excluídos, duplicados e reservados por outros usuários, calcula o score por regras, grava os leads e **liquida** a reserva cobrando só os entregues (e estornando o resto, ou tudo em caso de erro). A IA (Claude) só **ajusta** o score dentro de um limite e escreve a justificativa e as mensagens, sempre recebendo apenas os fatos verificáveis do lead. Tarefas agendadas (pg_cron + worker) cuidam de renovação de cota, expiração de reservas e lembretes de follow-up. Observabilidade com logs estruturados (sem dados pessoais), Sentry e uma tabela `api_usage` que alimenta o painel de custos.

```
                          ┌──────────────────────────────┐
  Celular / Navegador     │  Next.js (Vercel)            │
  (PWA, pt-BR)  ─────────▶│  • Páginas (RSC)             │
        ▲                 │  • Server Actions / API      │
        │ wa.me (manual)  │  • Rate limit (por user/IP)  │
        │                 │  • Validação (zod)           │
        │                 └──────┬───────────┬───────────┘
        │                        │           │
        │          SQL + RLS     │           │ enfileira job
        │                        ▼           ▼
        │          ┌────────────────────┐  ┌─────────────────────────┐
        │          │ Supabase           │  │ Worker de jobs          │
        │          │ • Postgres + RLS   │◀─│ (fila em Postgres ou    │
        │          │ • Auth             │  │  Inngest/Trigger.dev)   │
        │          │ • Storage (anexos, │  │ • busca de leads        │
        │          │   PDFs)            │  │ • follow-ups            │
        │          │ • pg_cron          │  │ • renovação de cota     │
        │          └────────────────────┘  └──────┬──────────┬───────┘
        │                                         │          │
        │                         interface       ▼          ▼
        │                         LeadProvider ┌────────┐ ┌──────────┐
        │                                      │ Google │ │ Claude   │
        │                                      │ Places │ │ (IA)     │
        │                                      │ (New)  │ └──────────┘
        │                                      └────────┘
        │
        └── E-mail transacional (Resend/SES)   Gateway (Fase 2: Asaas/MP/Stripe)
                                               └─ webhooks ─▶ API ─▶ credit_ledger
```

**Decisões principais e porquê**

| Decisão | Motivo |
|---|---|
| `LeadProvider` como interface (`search()`, `getDetails()`, `costOf()`) | Trocar Google por outro provedor sem mexer no resto. Também permite um `FakeProvider` com dados **claramente marcados como falsos** só em desenvolvimento. |
| Créditos em **ledger imutável** com `idempotency_key` única | Nenhuma cobrança dupla, nenhum débito sem registro; o saldo é sempre a soma do extrato. |
| Reserva → liquidação de créditos por busca | Garante "busca com erro não cobra" e "cobra só os entregues" de forma atômica. |
| Score por **regras puras em TypeScript** + ajuste da IA limitado (ex.: ±10) | O recibo soma exatamente a nota exibida; a IA nunca muda a nota "por fora". |
| IA recebe só um objeto `fatos_verificaveis` | Impede a IA de citar algo que não está nos dados; uma checagem pós-geração rejeita números que não estejam nos fatos. |
| `workspace_id` em vez de `user_id` nas tabelas | Prepara para equipe sem migração dolorosa. Na Fase 1, 1 usuário = 1 workspace. |
| Telefones guardados em E.164 e **hash** para bloqueio | O bloqueio global funciona sem precisar manter o dado da empresa que pediu remoção. |

---

## (c) Esquema de banco revisado

Convenções: `uuid` como PK, `created_at timestamptz default now()`, todo dado de usuário com `workspace_id` + RLS (`workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())`). Valores monetários em **centavos (`bigint`)**. Migrações versionadas (Supabase CLI). Coluna **Fase** indica quando a tabela entra.

### Identidade e configuração

| Tabela | Colunas principais | Fase |
|---|---|---|
| `profiles` | `id` (= auth.users.id), `nome`, `telefone_verificado`, `role` (`user`/`admin`), `created_at` | 1 |
| `workspaces` | `id`, `nome`, `plano_id`, `trial_usado_em`, `created_at` | 1 |
| `workspace_members` | `workspace_id`, `user_id`, `papel` (`owner`/`member`) | 1 |
| `workspace_settings` | `workspace_id`, `ofertas text[]`, `nichos_aceitos text[]`, `nichos_excluidos text[]` (padrão de exemplo: `{advocacia}`), `porte`, `regiao_padrao jsonb`, `estilo_mensagem` (`formal`/`amigavel`/`direto`), `sobre_mim`, `idioma_internacional`, `cadencia_followup int[]` (padrão `{3,5,7}`) | 1 |
| `consents` | `user_id`, `tipo` (termos, privacidade, marketing), `versao`, `aceito_em`, `ip_hash` | 1 |

### Empresas, deduplicação e bloqueio

| Tabela | Colunas principais | Fase |
|---|---|---|
| `businesses` | `id`, `provider` (`google_places`/`csv`/`manual`), `provider_id` (ex.: place_id), `nome`, `categoria`, `categorias text[]`, `endereco`, `cidade`, `uf`, `pais`, `telefone_e164`, `telefone_hash`, `whatsapp_provavel bool`, `site`, `rede_social`, `nota numeric(2,1)`, `avaliacoes int`, `horario jsonb`, `lat`, `lng`, `maps_url`, `email_publico`, `coletado_em`, `expira_em` | 1 |
| | **Único:** `(provider, provider_id)`. Índices em `telefone_hash` e em `endereco_normalizado_hash`. `expira_em` atende à política de cache escolhida na pergunta 2. | |
| `lead_reservations` | `business_id`, `workspace_id`, `reservado_ate` | 1 |
| | **Restrição de exclusão** (`btree_gist`): no máximo uma reserva ativa por `business_id` em cada instante. | |
| `blocked_businesses` | `id`, `provider`, `provider_id`, `telefone_hash`, `motivo`, `origem` (`pedido_remocao`/`admin`), `created_at` | 1 |
| `removal_requests` | `id`, `nome_empresa`, `contato` (e-mail ou telefone do solicitante), `provider_id`/`telefone` informados, `status` (`pendente`/`verificado`/`concluido`/`rejeitado`), `verificado_em`, `concluido_em` | 1 |

### Busca, leads e CRM

| Tabela | Colunas principais | Fase |
|---|---|---|
| `searches` | `id`, `workspace_id`, `user_id`, `nicho`, `cidade`, `uf`, `modalidade` (`brasil`/`exterior_br`/`internacional`), `filtro_oferta`, `status` (`na_fila`/`rodando`/`concluida`/`parcial`/`erro`), `pedidos`, `entregues`, `descartados jsonb` (contagens por motivo: duplicado, bloqueado, excluído, reservado), `erro_codigo`, `erro_msg`, `custo_api_centavos`, `created_at`, `finished_at` | 1 |
| `pipeline_stages` | `id`, `workspace_id`, `nome`, `ordem`, `tipo` (`aberto`/`ganho`/`perdido`) | 1 |
| `leads` | `id`, `workspace_id`, `business_id`, `search_id`, `stage_id`, `origem` (`busca`/`csv`/`manual`), `score int` (0–100), `score_recibo jsonb`, `score_versao_regras`, `temperatura` (`quente`/`morno`/`frio`), `valor_estimado_centavos`, `motivo_perda`, `motivo_perda_texto`, `descartado_em`, `created_at` | 1 |
| | **Único:** `(workspace_id, business_id)` → um negócio nunca aparece duas vezes na mesma conta. | |
| `lead_events` | `id`, `lead_id`, `workspace_id`, `user_id`, `tipo` (`etapa`/`nota`/`mensagem_gerada`/`mensagem_enviada`/`followup`/…), `de`, `para`, `dados jsonb`, `created_at` | 1 |
| `followups` | `id`, `lead_id`, `workspace_id`, `vence_em`, `concluido_em`, `origem` (`cadencia`/`manual`) | 1 (básico) / 2 (cadência completa) |
| `messages` | `id`, `lead_id`, `workspace_id`, `canal` (`whatsapp`/`email`/`ligacao`), `variacao` (`curta`/`media`/`pergunta`), `assunto`, `texto`, `fatos_usados jsonb`, `editada bool`, `enviada_em`, `created_at` | 1 |
| `tags`, `lead_tags` | `id`, `workspace_id`, `nome`, `cor` / `lead_id`, `tag_id` | 1 |
| `lead_notes`, `lead_attachments` | texto / caminho no Storage | 2 |

### Score

| Tabela | Colunas principais | Fase |
|---|---|---|
| `score_rules` | `chave` (ex.: `sem_site`, `poucas_avaliacoes`), `descricao`, `peso_padrao`, `parametros jsonb` (ex.: limite de avaliações), `ofertas_aplicaveis text[]`, `ativa` | 1 |
| `workspace_score_weights` | `workspace_id`, `regra_chave`, `peso` | 1 |

Exemplo de `score_recibo`:
```json
{ "base": 30, "versao": 3,
  "regras": [
    {"chave": "sem_site", "pontos": 25, "motivo": "Não há site cadastrado no Google"},
    {"chave": "poucas_avaliacoes", "pontos": 15, "motivo": "12 avaliações (limite: 30)"},
    {"chave": "telefone_celular", "pontos": 10, "motivo": "Número de celular, WhatsApp provável"}],
  "ajuste_ia": {"pontos": -5, "motivo": "Categoria pouco visual para vídeo"},
  "total": 75 }
```
O teste de aceite verifica `base + Σ regras + ajuste_ia = total` (com corte em 0 e 100 registrado no recibo).

### Créditos e custos

| Tabela | Colunas principais | Fase |
|---|---|---|
| `credit_ledger` | `id`, `workspace_id`, `delta int`, `tipo` (`cota_ciclo`/`expiracao_ciclo`/`trial`/`bonus`/`compra`/`reserva`/`liquidacao`/`estorno`/`ajuste_admin`), `motivo`, `referencia_tipo`, `referencia_id`, `saldo_antes`, `saldo_depois`, `idempotency_key` **único**, `criado_por`, `created_at` | 1 |
| | Inserção só por função `SECURITY DEFINER` com `SELECT … FOR UPDATE` no saldo; usuário só tem `SELECT`. | |
| `credit_balances` | `workspace_id`, `saldo`, `reservado`, `ciclo_inicio`, `ciclo_fim` (cache do ledger, atualizado na mesma transação) | 1 |
| `credit_pricing` | `modalidade`, `creditos_por_lead` (inicial 1/2/3), `fracao_max_cota`, `vigente_desde` | 1 (só `brasil` ativo) |
| `provider_quotas` | `provider`, `dia`, `limite_chamadas`, `usadas` | 1 |
| `api_usage` | `id`, `workspace_id`, `servico` (`places`/`ia`/`email`), `operacao`, `unidades`, `custo_estimado_micros`, `created_at` | 1 |
| `app_settings` | `chave`, `valor jsonb` (dias de exclusividade, leads do trial, bônus etc.) | 1 |

### Cobrança (Fase 2)
`plans` (nome, preço mensal/anual em centavos, cota, recursos jsonb), `subscriptions` (status, ciclo, cancel_at_period_end, gateway_id), `invoices`, `payments`, `coupons`, `webhook_events` (id externo **único**, para idempotência de webhooks).

### Projetos (Fase 3)
`projects` (workspace_id, lead_id, cliente, servico, descricao, status, valor_centavos, custo_centavos, **lucro gerado** = valor − custo, inicio, prazo, entregue_em, forma_pagamento, revisoes_combinadas), `project_tasks`, `checklist_templates`, `project_revisions`, `project_files`, `project_payments` (entrada/saída, previsto/recebido), `proposals`, `diagnostics`, `portfolio_items`.

### Aprendizado, comunidade e administração (Fase 4)
`learning_tracks`, `lessons`, `lesson_progress`, `plan_access`; `community_posts`, `community_reports`; `audit_log` (ator, ação, alvo, antes/depois — **entra já na Fase 1** para ajustes de crédito e bloqueios).

### Diferenças em relação ao rascunho original
1. `users` + `user_settings` → `profiles` + `workspaces` + `workspace_settings` (equipe no futuro).
2. `reservado_ate` saiu de `leads` para `lead_reservations` com restrição de exclusão (a reserva é **entre** contas, não da conta).
3. `proximo_followup` virou tabela `followups` (cadência com vários lembretes).
4. Novas: `pipeline_stages` (colunas renomeáveis), `score_rules`/`workspace_score_weights`, `credit_balances`, `credit_pricing`, `provider_quotas`, `api_usage`, `removal_requests`, `consents`, `app_settings`, `webhook_events`.
5. `credit_ledger` com `idempotency_key` e tipos de lançamento explícitos.

---

## (d) Plano da Fase 1 — MVP de prospecção

Cada passo termina com testes passando e um commit pequeno. Estimativa: **16 passos**.

| # | Passo | Entrega verificável |
|---|---|---|
| 1 | Esqueleto: Next.js + TS + Tailwind + ESLint/Prettier + Vitest + Playwright, PWA, CI no GitHub Actions | `npm test` e build verdes no CI |
| 2 | Supabase: projeto local, migrações das tabelas da Fase 1, RLS, seeds de `score_rules`, `pipeline_stages` padrão e `credit_pricing` | Teste de isolamento com 2 contas falha se RLS faltar |
| 3 | Auth: cadastro, confirmação de e-mail, login, recuperação de senha, registro de consentimentos | E2E de cadastro |
| 4 | Onboarding em 4 telas → `workspace_settings` | Filtros padrão aparecem na tela Buscar |
| 5 | Layout mobile: 5 abas (Hoje, Buscar, CRM, Projetos e Aprender como "em breve"), topo com saldo; estados carregando/vazio/erro | Revisão visual em 375 px |
| 6 | Módulo de **créditos**: funções SQL de reservar/liquidar/estornar, extrato, tela Meu saldo | Testes unitários de todos os casos de cobrança |
| 7 | `LeadProvider` + `GooglePlacesProvider` (Text Search + campos mínimos), `FakeProvider` para dev, controle de cota diária e `api_usage` | Teste de contrato do provider |
| 8 | Pipeline de busca (job): normalização de telefone, WhatsApp provável, filtros (bloqueados, excluídos, duplicados, reservados), reserva de 30 dias | Testes de deduplicação e exclusividade |
| 9 | **Score** por regras + recibo + etiqueta quente/morno/frio + painel de pesos | Teste "recibo soma o total" |
| 10 | Tela **Buscar**: formulário com autocomplete de cidade, progresso, cartões, ação em lote | E2E de busca com FakeProvider |
| 11 | **Detalhe do lead**: dados, recibo, histórico | — |
| 12 | **Mensagens por IA**: 3 variações × canais, checagem de fatos, opt-out, link `wa.me` codificado, registro no histórico | Testes do link e da checagem de fatos |
| 13 | **CRM Kanban** básico: colunas, arrastar e soltar acessível, evento por mudança, motivo de perda, follow-up manual | E2E "arrasta, recarrega, persiste" |
| 14 | **Teste grátis**: N leads sem cartão, só Brasil todo, 1 por conta | Teste de limite |
| 15 | Páginas públicas: início, Privacidade, Termos (rascunho para revisão jurídica), **Remover minha empresa** com verificação e efeito global | E2E do pedido de remoção |
| 16 | Endurecimento: rate limit, cabeçalhos de segurança, Sentry, README, demonstração e lista do que ficou de fora | Checklist de aceite da Fase 1 |

**Fica fora da Fase 1 de propósito:** pagamentos, regiões fora do Brasil, cadência automática completa, Tarefas de hoje, modo foco, CSV, painel, projetos, aprendizado, admin completo (na Fase 1 o admin é só: ajuste de créditos com motivo e fila de remoção).

---

## Riscos

| # | Risco | Impacto | Mitigação proposta |
|---|---|---|---|
| R1 | **Termos do Google sobre armazenar dados do Places** | Alto (suspensão da chave, questão contratual) | Pergunta 2. Guardar sempre o `place_id`; demais campos conforme opção escolhida; exibir atribuição "Google" onde os dados aparecem. |
| R2 | **Custo da Places API** cresce com campos de contato (telefone, site, nota ficam em faixas de preço mais altas) | Médio/alto | Field mask mínimo, cache permitido, teto diário rígido em `provider_quotas`, alerta de custo. Preços exatos: verificar na tabela oficial antes de fixar o valor do crédito. |
| R3 | Limite de ~60 resultados por consulta + exclusividade de 30 dias | Médio (usuário recebe poucos leads) | Variar termos/bairros automaticamente; mostrar com honestidade quantos foram filtrados e por quê; nunca cobrar os não entregues. |
| R4 | **LGPD** em telefones de MEI/autônomos | Alto | Legítimo interesse documentado (LIA), opt-out em toda mensagem, remoção global, retenção definida, nenhum dado pessoal em log. Revisão por advogado antes do lançamento. |
| R5 | Banimento de WhatsApp do **usuário** por excesso de mensagens frias | Médio | Envio só manual; aviso de boas práticas; limite sugerido de abordagens por dia no modo foco. |
| R6 | IA inventando fatos | Alto (confiança) | Entrada restrita a `fatos_verificaveis`, validação pós-geração e fallback para mensagem genérica. |
| R7 | Abuso do teste grátis | Médio | 1 por e-mail confirmado + limite por IP/dispositivo; telefone verificado se necessário. |
| R8 | Cobrança de crédito inconsistente em falhas parciais | Alto | Ledger idempotente + reserva/liquidação na mesma transação + testes de cada caso. |
| R9 | "Brasileiros no exterior" sem dado real de nacionalidade | Médio (promessa enganosa) | Descrever a modalidade como "negócios com público brasileiro" e nunca afirmar a nacionalidade do dono. |
