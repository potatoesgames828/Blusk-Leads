# Blusk Leads — Decisões da Fase 1 e o que ficou de fora

Você pediu para eu decidir sem interromper. Abaixo, cada decisão, o motivo e como mudar se não concordar.

## Respostas que assumi para as perguntas da proposta

| # | Pergunta | Decisão | Como mudar |
|---|---|---|---|
| 1 | Provedor de dados | Google Places API (New), oficial, atrás de `LeadProvider` | Novo arquivo em `src/lib/providers/` |
| 2 | Guardar dados do Google | Guardar o `place_id` sempre; demais campos com `expira_em` de 30 dias, renovados ao abrir o lead e limpos (cron) quando não estão em nenhum lead. **Validar com advogado** | `app_settings.dias_cache_google` |
| 3 | IA | Claude via SDK oficial, opcional, com verificador de fatos e modelo seguro | `ANTHROPIC_API_KEY`, `AI_MODEL` |
| 4 | Hospedagem | Vercel + Postgres gerenciado. Auth própria (não depende do Supabase Auth) | — |
| 5 | Domínio | Textos usam blusk.com.br como exemplo de remetente | `EMAIL_FROM`, `APP_URL` |
| 6 | E-mail | Resend (API simples); sem chave, caixa de dev | `RESEND_API_KEY` |
| 7 | Identidade visual | Neutros frios + um destaque azul (#3443d9), logo provisória "B" | `src/app/globals.css`, `src/components/logo.tsx` |
| 8 | Teste grátis | 5 leads, sem cartão, 1 por conta, Brasil todo | `app_settings.leads_teste_gratis` |
| 9 | Login social | Fora da Fase 1 | — |
| 10 | Equipe | Modelado com `workspaces` (1 usuário = 1 workspace hoje) | — |
| 22 | "Potencial para vídeo" | Só sinais reais: categoria visual + nota ≥ 4,0 + ≥ 20 avaliações. A tela diz que não verificamos se o negócio já tem vídeo | `src/lib/filters.ts` |
| 23 | E-mail público | Sempre "não disponível" (o Google não fornece; não fazemos raspagem) | — |
| 24 | Base legal | Legítimo interesse + opt-out em toda mensagem + remoção global | Política de Privacidade |

## Decisões técnicas

- **RLS de verdade:** toda consulta de usuário roda com `SET LOCAL ROLE blusk_app` e `app.user_id`. O papel não pode mexer em créditos, sessões, hashes de senha ou tabelas de sistema. Testado em `tests/db/isolation-crm-removal.test.ts`.
- **Créditos:** a função `app.credit_apply` é o único caminho para movimentar saldo. É idempotente (`idempotency_key` única), trava a linha do saldo e não deixa ficar negativo. A busca **reserva** os créditos do pedido e, ao terminar, **estorna** o que não foi entregue, contando os leads pelo banco (vale mesmo após uma queda). Buscas presas por mais de 10 minutos são encerradas e estornadas.
- **Exclusividade:** restrição de exclusão no Postgres (`btree_gist`) impede duas reservas ativas do mesmo negócio. Buscas simultâneas de contas diferentes nunca entregam o mesmo lead (testado).
- **Busca assíncrona:** `after()` do Next.js roda a busca depois da resposta; a tela acompanha por polling. Na Fase 2, se precisar de buscas mais longas, trocar por uma fila (Inngest/Trigger.dev) sem mudar `runSearch`.
- **Telefone:** só celulares brasileiros (9 dígitos começando com 9) contam como "WhatsApp provável". Números ambíguos são recusados, nunca "chutados".
- **Dados fictícios:** o provedor `fake` usa DDD 10 (inexistente) e prefixo "[FICTÍCIO]"; é bloqueado em produção.
- **Porte da empresa:** guardado como preferência; o Google não informa porte com precisão, então não é filtro rígido.

## Ficou de fora da Fase 1 (planejado)

- Planos pagos, Pix/cartão, renovação de cota, bônus de conversão, compra de créditos (Fase 2).
- Modalidades "brasileiros no exterior" e "internacional" (o banco e a tabela de custos já suportam).
- Sessão de prospecção (modo foco), importação/exportação CSV, painel com funil e gráficos (Fase 2).
- Ajuste de score pela IA (o recibo já tem o campo `ajuste_ia`).
- Anexos em leads; login social.
- Projetos, financeiro, propostas/diagnósticos em PDF, portfólio (Fase 3).
- Trilhas e aulas, comunidade, admin completo de conteúdo (Fase 4).

## Antes de ir para produção

1. Criar a chave da Google Places API (New) com restrição e orçamento/alerta no Google Cloud.
2. Validar com advogado: política de cache dos dados do Google, Política de Privacidade, Termos, dados do controlador e do encarregado.
3. Configurar domínio, SPF/DKIM do e-mail e `CRON_SECRET`.
4. Sentry (ou similar) para erros; backups automáticos do Postgres (Supabase/Neon já fazem) e teste de restauração.
