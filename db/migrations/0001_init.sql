-- Blusk Leads — esquema inicial (Fase 1)
-- Convenções:
--  * Todo dado de usuário tem workspace_id e é protegido por Row Level Security.
--  * O app executa consultas de usuário com SET LOCAL ROLE blusk_app + app.user_id,
--    então as políticas abaixo valem de verdade (o papel não tem BYPASSRLS).
--  * Valores em dinheiro: centavos (bigint). Créditos: inteiros.

create extension if not exists citext;
create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- ───────────────────────── Papel restrito da aplicação ─────────────────────────
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'blusk_app') then
    create role blusk_app nologin;
  end if;
end $$;
grant blusk_app to current_user;

create schema if not exists app;
grant usage on schema app to blusk_app;
grant usage on schema public to blusk_app;

create or replace function app.current_user_id() returns uuid
language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;

-- ───────────────────────── Identidade ─────────────────────────
create table users (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  password_hash text not null,
  nome text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  email_confirmado_em timestamptz,
  created_at timestamptz not null default now()
);

create table sessions (
  id text primary key,                -- sha256 do token do cookie (o token em si nunca é salvo)
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index sessions_user_idx on sessions(user_id);

create table email_tokens (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  tipo text not null check (tipo in ('confirmacao', 'redefinir_senha')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  tipo text not null check (tipo in ('termos', 'privacidade', 'marketing')),
  versao text not null,
  aceito_em timestamptz not null default now()
);

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  plano text not null default 'teste' check (plano in ('teste', 'pago')),
  onboarding_concluido_em timestamptz,
  created_at timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  papel text not null default 'owner' check (papel in ('owner', 'member')),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on workspace_members(user_id);

-- Workspaces do usuário atual. SECURITY DEFINER evita recursão de RLS.
create or replace function app.user_workspaces() returns setof uuid
language sql stable security definer set search_path = public as $$
  select workspace_id from workspace_members where user_id = app.current_user_id()
$$;
grant execute on function app.user_workspaces() to blusk_app;
grant execute on function app.current_user_id() to blusk_app;

create table workspace_settings (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  ofertas text[] not null default '{}',
  nichos_aceitos text[] not null default '{}',
  nichos_excluidos text[] not null default '{}',
  porte text not null default 'qualquer' check (porte in ('pequeno', 'medio', 'grande', 'qualquer')),
  regiao_padrao jsonb not null default '{"tipo":"brasil"}',
  estilo_mensagem text not null default 'amigavel' check (estilo_mensagem in ('formal', 'amigavel', 'direto')),
  sobre_mim text not null default '',
  cadencia_followup int[] not null default '{3,5,7}',
  updated_at timestamptz not null default now()
);

-- ───────────────────────── Empresas, bloqueio e reservas ─────────────────────────
create table businesses (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('google_places', 'fake', 'csv', 'manual')),
  provider_id text not null,
  nome text not null,
  categoria text,
  tipos text[] not null default '{}',
  endereco text,
  cidade text,
  uf text,
  pais text not null default 'BR',
  telefone_e164 text,
  telefone_hash text,
  whatsapp_provavel boolean not null default false,
  site text,
  rede_social text,
  nota numeric(2,1),
  avaliacoes int,
  horario jsonb,
  lat double precision,
  lng double precision,
  maps_url text,
  email_publico text,
  status_funcionamento text,
  coletado_em timestamptz not null default now(),
  -- Conteúdo do Google deve ser renovado/limpo após este prazo (política de cache).
  expira_em timestamptz,
  unique (provider, provider_id)
);
create index businesses_phone_hash_idx on businesses(telefone_hash);

create table blocked_businesses (
  id uuid primary key default gen_random_uuid(),
  provider text,
  provider_id text,
  telefone_hash text,
  motivo text not null,
  origem text not null check (origem in ('pedido_remocao', 'admin')),
  removal_request_id uuid,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  check (provider_id is not null or telefone_hash is not null)
);
create index blocked_provider_idx on blocked_businesses(provider, provider_id) where ativo;
create index blocked_phone_idx on blocked_businesses(telefone_hash) where ativo;

create table removal_requests (
  id uuid primary key default gen_random_uuid(),
  nome_empresa text not null,
  telefone_hash text,
  telefone_final text,                -- só os 4 últimos dígitos, para conferência humana
  contato_email citext,
  cidade text,
  mensagem text,
  status text not null default 'aplicado' check (status in ('aplicado', 'rejeitado')),
  leads_afetados int not null default 0,
  revisado_por uuid references users(id),
  revisado_em timestamptz,
  created_at timestamptz not null default now()
);

create table lead_reservations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  reservado_de timestamptz not null default now(),
  reservado_ate timestamptz not null,
  -- Um negócio só pode estar reservado para UMA conta em cada instante.
  exclude using gist (business_id with =, tstzrange(reservado_de, reservado_ate) with &&)
);
create index lead_reservations_ws_idx on lead_reservations(workspace_id);

-- ───────────────────────── Busca, leads e CRM ─────────────────────────
create table searches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references users(id),
  nicho text not null,
  cidade text,
  uf text,
  modalidade text not null default 'brasil' check (modalidade in ('brasil', 'exterior_br', 'internacional')),
  filtro_oferta text not null,
  status text not null default 'na_fila' check (status in ('na_fila', 'rodando', 'concluida', 'parcial', 'erro')),
  pedidos int not null check (pedidos between 1 and 60),
  entregues int not null default 0,
  creditos_por_lead int not null,
  descartados jsonb not null default '{}',
  aviso text,
  erro_codigo text,
  erro_msg text,
  chamadas_api int not null default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index searches_ws_idx on searches(workspace_id, created_at desc);

create table pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  nome text not null,
  ordem int not null,
  tipo text not null default 'aberto' check (tipo in ('aberto', 'ganho', 'perdido')),
  chave text,                          -- estável: novo, qualificado, contatado, ...
  unique (workspace_id, ordem) deferrable initially deferred
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  business_id uuid not null references businesses(id),
  search_id uuid references searches(id) on delete set null,
  stage_id uuid references pipeline_stages(id),
  no_crm boolean not null default false,
  origem text not null check (origem in ('busca', 'csv', 'manual')),
  score int not null check (score between 0 and 100),
  score_recibo jsonb not null,
  temperatura text not null check (temperatura in ('quente', 'morno', 'frio')),
  valor_estimado_centavos bigint,
  motivo_perda text,
  motivo_perda_texto text,
  descartado_em timestamptz,
  bloqueado_em timestamptz,            -- empresa pediu remoção: some de todas as telas
  ultima_interacao_em timestamptz,
  created_at timestamptz not null default now(),
  -- Deduplicação: o mesmo negócio nunca aparece duas vezes na mesma conta.
  unique (workspace_id, business_id)
);
create index leads_ws_stage_idx on leads(workspace_id, stage_id) where no_crm and descartado_em is null and bloqueado_em is null;
create index leads_search_idx on leads(search_id);
create index leads_business_idx on leads(business_id);

create table lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid references users(id),
  tipo text not null,
  de text,
  para text,
  dados jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index lead_events_lead_idx on lead_events(lead_id, created_at desc);

create table followups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  vence_em date not null,
  concluido_em timestamptz,
  origem text not null default 'manual' check (origem in ('cadencia', 'manual')),
  created_at timestamptz not null default now()
);
create index followups_ws_due_idx on followups(workspace_id, vence_em) where concluido_em is null;

create table messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  canal text not null check (canal in ('whatsapp', 'email', 'ligacao')),
  variacao text not null,
  assunto text,
  texto text not null,
  fatos_usados jsonb not null default '[]',
  gerador text not null check (gerador in ('ia', 'modelo')),
  enviada_em timestamptz,
  created_at timestamptz not null default now()
);
create index messages_lead_idx on messages(lead_id, created_at desc);

create table tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  nome text not null,
  unique (workspace_id, nome)
);
create table lead_tags (
  lead_id uuid not null references leads(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  primary key (lead_id, tag_id)
);

create table lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid references users(id),
  texto text not null,
  created_at timestamptz not null default now()
);

-- ───────────────────────── Score ─────────────────────────
create table workspace_score_weights (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  regra text not null,
  peso int not null check (peso between -50 and 50),
  primary key (workspace_id, regra)
);

-- ───────────────────────── Créditos ─────────────────────────
create table credit_balances (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  saldo int not null default 0 check (saldo >= 0),
  updated_at timestamptz not null default now()
);

create table credit_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  delta int not null check (delta <> 0),
  tipo text not null check (tipo in ('teste_gratis', 'bonus', 'cota_ciclo', 'compra', 'reserva_busca', 'estorno_busca', 'ajuste_admin')),
  motivo text not null,
  referencia_tipo text,
  referencia_id uuid,
  saldo_antes int not null,
  saldo_depois int not null check (saldo_depois >= 0),
  idempotency_key text not null unique,
  criado_por uuid references users(id),
  created_at timestamptz not null default now(),
  check (saldo_depois = saldo_antes + delta)
);
create index credit_ledger_ws_idx on credit_ledger(workspace_id, created_at desc);

-- Único caminho para mexer em créditos. Idempotente: a mesma chave nunca lança duas vezes.
-- Retorna o lançamento (novo ou já existente). Lança erro 'saldo_insuficiente' se faltar crédito.
create or replace function app.credit_apply(
  p_workspace uuid, p_delta int, p_tipo text, p_motivo text,
  p_ref_tipo text, p_ref_id uuid, p_key text, p_actor uuid
) returns credit_ledger
language plpgsql security definer set search_path = public as $$
declare
  v_saldo int;
  v_row credit_ledger;
begin
  select * into v_row from credit_ledger where idempotency_key = p_key;
  if found then
    return v_row;
  end if;

  insert into credit_balances(workspace_id) values (p_workspace) on conflict do nothing;
  select saldo into v_saldo from credit_balances where workspace_id = p_workspace for update;

  -- Re-checa após o lock (outra transação pode ter usado a mesma chave).
  select * into v_row from credit_ledger where idempotency_key = p_key;
  if found then
    return v_row;
  end if;

  if v_saldo + p_delta < 0 then
    raise exception 'saldo_insuficiente' using errcode = 'P0001';
  end if;

  insert into credit_ledger(workspace_id, delta, tipo, motivo, referencia_tipo, referencia_id,
                            saldo_antes, saldo_depois, idempotency_key, criado_por)
  values (p_workspace, p_delta, p_tipo, p_motivo, p_ref_tipo, p_ref_id,
          v_saldo, v_saldo + p_delta, p_key, p_actor)
  returning * into v_row;

  update credit_balances set saldo = v_saldo + p_delta, updated_at = now() where workspace_id = p_workspace;
  return v_row;
end $$;
revoke all on function app.credit_apply(uuid, int, text, text, text, uuid, text, uuid) from public;

-- ───────────────────────── Configuração, cotas e custos ─────────────────────────
create table app_settings (
  chave text primary key,
  valor jsonb not null,
  updated_at timestamptz not null default now()
);
insert into app_settings(chave, valor) values
  ('creditos_por_lead', '{"brasil":1,"exterior_br":2,"internacional":3}'),
  ('dias_exclusividade', '30'),
  ('leads_teste_gratis', '5'),
  ('dias_cache_google', '30');

create table provider_quotas (
  provider text not null,
  dia date not null,
  limite int not null,
  usadas int not null default 0,
  primary key (provider, dia)
);

create table api_usage (
  id bigserial primary key,
  workspace_id uuid references workspaces(id) on delete set null,
  servico text not null check (servico in ('places', 'ia', 'email')),
  operacao text not null,
  unidades int not null default 1,
  sucesso boolean not null default true,
  created_at timestamptz not null default now()
);
create index api_usage_day_idx on api_usage(created_at);

create table rate_limits (
  chave text primary key,
  janela_inicio timestamptz not null,
  contagem int not null
);

create table outbox_emails (
  id uuid primary key default gen_random_uuid(),
  para citext not null,
  assunto text not null,
  corpo_texto text not null,
  status text not null default 'pendente' check (status in ('pendente', 'enviado', 'falhou', 'dev')),
  erro text,
  created_at timestamptz not null default now(),
  enviado_em timestamptz
);

create table audit_log (
  id bigserial primary key,
  ator_id uuid references users(id),
  acao text not null,
  alvo_tipo text,
  alvo_id text,
  dados jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ───────────────────────── Row Level Security ─────────────────────────
-- Tabelas por workspace: o usuário só enxerga linhas dos workspaces de que é membro.
do $$
declare t text;
begin
  foreach t in array array[
    'workspace_settings', 'searches', 'pipeline_stages', 'leads', 'lead_events', 'followups',
    'messages', 'tags', 'lead_tags', 'lead_notes', 'workspace_score_weights', 'lead_reservations'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I for all to blusk_app using (workspace_id in (select app.user_workspaces())) with check (workspace_id in (select app.user_workspaces()))',
      t || '_ws', t);
    execute format('grant select, insert, update, delete on %I to blusk_app', t);
  end loop;
end $$;

-- Leitura apenas (escrita só pelo servidor com o papel dono).
alter table credit_balances enable row level security;
create policy credit_balances_ws on credit_balances for select to blusk_app
  using (workspace_id in (select app.user_workspaces()));
grant select on credit_balances to blusk_app;

alter table credit_ledger enable row level security;
create policy credit_ledger_ws on credit_ledger for select to blusk_app
  using (workspace_id in (select app.user_workspaces()));
grant select on credit_ledger to blusk_app;

alter table workspaces enable row level security;
create policy workspaces_member on workspaces for select to blusk_app
  using (id in (select app.user_workspaces()));
grant select on workspaces to blusk_app;

alter table workspace_members enable row level security;
create policy workspace_members_self on workspace_members for select to blusk_app
  using (workspace_id in (select app.user_workspaces()));
grant select on workspace_members to blusk_app;

alter table users enable row level security;
create policy users_self on users for select to blusk_app using (id = app.current_user_id());
grant select (id, email, nome, role, email_confirmado_em, created_at) on users to blusk_app;
grant update (nome) on users to blusk_app;
create policy users_self_update on users for update to blusk_app using (id = app.current_user_id());

-- Empresas: o usuário vê apenas empresas ligadas a leads dele (não navega pela base global).
alter table businesses enable row level security;
create policy businesses_via_lead on businesses for select to blusk_app
  using (exists (select 1 from leads l where l.business_id = businesses.id
                 and l.workspace_id in (select app.user_workspaces())));
grant select on businesses to blusk_app;

-- Tabelas de sistema: sem acesso para blusk_app (RLS ligada e nenhuma política).
alter table sessions enable row level security;
alter table email_tokens enable row level security;
alter table consents enable row level security;
alter table blocked_businesses enable row level security;
alter table removal_requests enable row level security;
alter table app_settings enable row level security;
alter table provider_quotas enable row level security;
alter table api_usage enable row level security;
alter table rate_limits enable row level security;
alter table outbox_emails enable row level security;
alter table audit_log enable row level security;
