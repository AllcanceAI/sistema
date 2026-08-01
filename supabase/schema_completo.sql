-- ============================================================
-- SCHEMA COMPLETO — OFICINA HM AUTO ELÉTRICA
-- Execute este SQL no Supabase > SQL Editor > New Query
-- ============================================================
-- ATENÇÃO: Este script usa "IF NOT EXISTS" e "ON CONFLICT DO NOTHING"
-- para ser seguro de re-executar sem apagar dados.
-- ============================================================

-- 1. EXTENSÕES
create extension if not exists "pgcrypto";

-- 2. TIPOS ENUM (apenas cria se não existir)
do $$ begin
  create type public.app_role as enum ('dono','gerente','secretaria','mecanico','contabilidade','funcionario');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.os_mode as enum ('express','analise');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.os_status as enum (
    'recebido','checklist','diagnostico','orcamento',
    'aguardando_aprovacao','aprovado','compra_pecas',
    'em_execucao','concluido','entregue','cancelado'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.media_stage as enum ('entrada','checklist','defeito','peca_nova','servico_concluido','outro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.approval_stage as enum ('orcamento','compra_pecas','execucao','entrega');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.approval_decision as enum ('pendente','aprovado','reprovado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.client_kind as enum ('pessoa','empresa');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.checklist_kind as enum ('entrada','diagnostico');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.check_state as enum ('ok','atencao','critico','na');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('dinheiro','pix','debito','credito','boleto','transferencia','faturado');
exception when duplicate_object then null; end $$;

-- 3. SCHEMA PRIVADO PARA FUNÇÕES INTERNAS
create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated, anon, service_role;

-- 4. FUNÇÕES DE AUTORIZAÇÃO (schema app_private — mais seguro)
create or replace function app_private.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function app_private.has_any_role(_user_id uuid, _roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = any(_roles))
$$;

create or replace function app_private.is_active_user(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = _user_id and active = true)
$$;

create or replace function app_private.is_manager(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select app_private.has_any_role(_user_id, array['dono','gerente']::public.app_role[])
$$;

grant execute on function app_private.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function app_private.has_any_role(uuid, public.app_role[]) to authenticated, service_role;
grant execute on function app_private.is_active_user(uuid) to authenticated, service_role;
grant execute on function app_private.is_manager(uuid) to authenticated, service_role;

-- Manter compatibilidade com chamadas usando prefixo public.*
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select app_private.has_role(_user_id, _role)
$$;
create or replace function public.has_any_role(_user_id uuid, _roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select app_private.has_any_role(_user_id, _roles)
$$;
create or replace function public.is_active_user(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select app_private.is_active_user(_user_id)
$$;
create or replace function public.is_manager(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select app_private.is_manager(_user_id)
$$;

grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function public.has_any_role(uuid, public.app_role[]) to authenticated, service_role;
grant execute on function public.is_active_user(uuid) to authenticated, service_role;
grant execute on function public.is_manager(uuid) to authenticated, service_role;

-- 5. TABELAS
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  job_title text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role public.app_role not null,
  permission text not null,
  allowed boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (role, permission)
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cnpj text,
  contact_name text,
  phone text,
  email text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  document text,
  kind public.client_kind not null default 'pessoa',
  company_id uuid references public.companies(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  plate text not null,
  brand text,
  model text,
  year int,
  color text,
  km int,
  client_id uuid references public.clients(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists vehicles_plate_key on public.vehicles (upper(plate));

create sequence if not exists public.service_order_number_seq;

create table if not exists public.service_orders (
  id uuid primary key default gen_random_uuid(),
  number int not null default nextval('public.service_order_number_seq'),
  mode public.os_mode not null default 'express',
  status public.os_status not null default 'recebido',
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  client_id uuid references public.clients(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  complaint text,
  diagnosis text,
  solution text,
  final_report text,
  estimated_minutes int,
  promised_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  mechanic_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.checklists (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  kind public.checklist_kind not null default 'entrada',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklists(id) on delete cascade,
  label text not null,
  state public.check_state not null default 'na',
  note text,
  position int not null default 0
);

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  checklist_id uuid references public.checklists(id) on delete set null,
  stage public.media_stage not null default 'outro',
  storage_path text not null,
  mime_type text,
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  labor_total numeric(12,2) not null default 0,
  parts_total numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  description text not null,
  kind text not null default 'peca',
  quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0
);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  supplier text,
  description text,
  total numeric(12,2) not null default 0,
  status text not null default 'pendente',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  purchase_order_id uuid references public.purchase_orders(id) on delete cascade,
  stage public.approval_stage not null,
  required_role public.app_role not null,
  decision public.approval_decision not null default 'pendente',
  signature text,
  note text,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  amount numeric not null default 0,
  method public.payment_method not null default 'pix',
  paid_at timestamptz not null default now(),
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  category text not null default 'geral',
  amount numeric not null default 0,
  spent_at timestamptz not null default now(),
  service_order_id uuid references public.service_orders(id) on delete set null,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

-- 6. ÍNDICES PARA PERFORMANCE
create index if not exists payments_os_idx on public.payments(service_order_id);
create index if not exists payments_paid_at_idx on public.payments(paid_at desc);
create index if not exists expenses_spent_at_idx on public.expenses(spent_at desc);
create index if not exists service_orders_status_idx on public.service_orders(status);
create index if not exists service_orders_vehicle_idx on public.service_orders(vehicle_id);
create index if not exists service_orders_created_at_idx on public.service_orders(created_at desc);

-- 7. GRANTS (permissões de acesso às tabelas)
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

grant select on public.role_permissions to authenticated;
grant all on public.role_permissions to service_role;

grant select, insert, update, delete on public.companies to authenticated;
grant all on public.companies to service_role;

grant select, insert, update, delete on public.clients to authenticated;
grant all on public.clients to service_role;

grant select, insert, update, delete on public.vehicles to authenticated;
grant all on public.vehicles to service_role;

grant select, insert, update, delete on public.service_orders to authenticated;
grant all on public.service_orders to service_role;

grant select, insert, update, delete on public.checklists to authenticated;
grant all on public.checklists to service_role;

grant select, insert, update, delete on public.checklist_items to authenticated;
grant all on public.checklist_items to service_role;

grant select, insert, update, delete on public.media to authenticated;
grant all on public.media to service_role;

grant select, insert, update, delete on public.quotes to authenticated;
grant all on public.quotes to service_role;

grant select, insert, update, delete on public.quote_items to authenticated;
grant all on public.quote_items to service_role;

grant select, insert, update, delete on public.purchase_orders to authenticated;
grant all on public.purchase_orders to service_role;

grant select, insert, update, delete on public.approvals to authenticated;
grant all on public.approvals to service_role;

grant select, insert, update, delete on public.payments to authenticated;
grant all on public.payments to service_role;

grant select, insert, update, delete on public.expenses to authenticated;
grant all on public.expenses to service_role;

grant select, insert on public.audit_log to authenticated;
grant all on public.audit_log to service_role;

-- 8. HABILITAR RLS EM TODAS AS TABELAS
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.companies enable row level security;
alter table public.clients enable row level security;
alter table public.vehicles enable row level security;
alter table public.service_orders enable row level security;
alter table public.checklists enable row level security;
alter table public.checklist_items enable row level security;
alter table public.media enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.approvals enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
alter table public.audit_log enable row level security;

-- 9. POLÍTICAS RLS
-- Profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "profiles_select_staff" on public.profiles;
create policy "profiles_select_staff" on public.profiles for select to authenticated using (app_private.is_active_user(auth.uid()));
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "profiles_manage_owner" on public.profiles;
create policy "profiles_manage_owner" on public.profiles for all to authenticated using (app_private.has_role(auth.uid(), 'dono')) with check (app_private.has_role(auth.uid(), 'dono'));

-- User roles
drop policy if exists "user_roles_select" on public.user_roles;
create policy "user_roles_select" on public.user_roles for select to authenticated using (user_id = auth.uid() or app_private.is_manager(auth.uid()));

-- Role permissions
drop policy if exists "role_permissions_select" on public.role_permissions;
create policy "role_permissions_select" on public.role_permissions for select to authenticated using (app_private.is_active_user(auth.uid()));

-- Companies
drop policy if exists "companies_select" on public.companies;
create policy "companies_select" on public.companies for select to authenticated using (app_private.is_active_user(auth.uid()));
drop policy if exists "companies_write" on public.companies;
create policy "companies_write" on public.companies for all to authenticated
  using (app_private.has_any_role(auth.uid(), array['dono','gerente','secretaria']::public.app_role[]))
  with check (app_private.has_any_role(auth.uid(), array['dono','gerente','secretaria']::public.app_role[]));

-- Clients
drop policy if exists "clients_select" on public.clients;
create policy "clients_select" on public.clients for select to authenticated using (app_private.is_active_user(auth.uid()));
drop policy if exists "clients_write" on public.clients;
create policy "clients_write" on public.clients for all to authenticated
  using (app_private.has_any_role(auth.uid(), array['dono','gerente','secretaria']::public.app_role[]))
  with check (app_private.has_any_role(auth.uid(), array['dono','gerente','secretaria']::public.app_role[]));

-- Vehicles
drop policy if exists "vehicles_select" on public.vehicles;
create policy "vehicles_select" on public.vehicles for select to authenticated using (app_private.is_active_user(auth.uid()));
drop policy if exists "vehicles_write" on public.vehicles;
create policy "vehicles_write" on public.vehicles for all to authenticated
  using (app_private.has_any_role(auth.uid(), array['dono','gerente','secretaria']::public.app_role[]))
  with check (app_private.has_any_role(auth.uid(), array['dono','gerente','secretaria']::public.app_role[]));

-- Service Orders
drop policy if exists "service_orders_select" on public.service_orders;
create policy "service_orders_select" on public.service_orders for select to authenticated using (app_private.is_active_user(auth.uid()));
drop policy if exists "service_orders_insert" on public.service_orders;
create policy "service_orders_insert" on public.service_orders for insert to authenticated
  with check (app_private.has_any_role(auth.uid(), array['dono','gerente','secretaria']::public.app_role[]));
drop policy if exists "service_orders_update" on public.service_orders;
create policy "service_orders_update" on public.service_orders for update to authenticated
  using (app_private.has_any_role(auth.uid(), array['dono','gerente','secretaria']::public.app_role[]) or mechanic_id = auth.uid())
  with check (app_private.has_any_role(auth.uid(), array['dono','gerente','secretaria']::public.app_role[]) or mechanic_id = auth.uid());
drop policy if exists "service_orders_delete" on public.service_orders;
create policy "service_orders_delete" on public.service_orders for delete to authenticated using (app_private.is_manager(auth.uid()));

-- Checklists
drop policy if exists "checklists_select" on public.checklists;
create policy "checklists_select" on public.checklists for select to authenticated using (app_private.is_active_user(auth.uid()));
drop policy if exists "checklists_write" on public.checklists;
create policy "checklists_write" on public.checklists for all to authenticated
  using (app_private.has_any_role(auth.uid(), array['dono','gerente','secretaria','mecanico']::public.app_role[]))
  with check (app_private.has_any_role(auth.uid(), array['dono','gerente','secretaria','mecanico']::public.app_role[]));

-- Checklist Items
drop policy if exists "checklist_items_select" on public.checklist_items;
create policy "checklist_items_select" on public.checklist_items for select to authenticated using (app_private.is_active_user(auth.uid()));
drop policy if exists "checklist_items_write" on public.checklist_items;
create policy "checklist_items_write" on public.checklist_items for all to authenticated
  using (app_private.has_any_role(auth.uid(), array['dono','gerente','secretaria','mecanico']::public.app_role[]))
  with check (app_private.has_any_role(auth.uid(), array['dono','gerente','secretaria','mecanico']::public.app_role[]));

-- Media
drop policy if exists "media_select" on public.media;
create policy "media_select" on public.media for select to authenticated using (app_private.is_active_user(auth.uid()));
drop policy if exists "media_insert" on public.media;
create policy "media_insert" on public.media for insert to authenticated
  with check (app_private.is_active_user(auth.uid()) and created_by = auth.uid());
drop policy if exists "media_delete" on public.media;
create policy "media_delete" on public.media for delete to authenticated
  using (created_by = auth.uid() or app_private.is_manager(auth.uid()));

-- Quotes
drop policy if exists "quotes_select" on public.quotes;
create policy "quotes_select" on public.quotes for select to authenticated using (app_private.is_active_user(auth.uid()));
drop policy if exists "quotes_write" on public.quotes;
create policy "quotes_write" on public.quotes for all to authenticated
  using (app_private.has_any_role(auth.uid(), array['dono','gerente','secretaria','mecanico']::public.app_role[]))
  with check (app_private.has_any_role(auth.uid(), array['dono','gerente','secretaria','mecanico']::public.app_role[]));

-- Quote Items
drop policy if exists "quote_items_select" on public.quote_items;
create policy "quote_items_select" on public.quote_items for select to authenticated using (app_private.is_active_user(auth.uid()));
drop policy if exists "quote_items_write" on public.quote_items;
create policy "quote_items_write" on public.quote_items for all to authenticated
  using (app_private.has_any_role(auth.uid(), array['dono','gerente','secretaria','mecanico']::public.app_role[]))
  with check (app_private.has_any_role(auth.uid(), array['dono','gerente','secretaria','mecanico']::public.app_role[]));

-- Purchase Orders
drop policy if exists "purchase_orders_select" on public.purchase_orders;
create policy "purchase_orders_select" on public.purchase_orders for select to authenticated using (app_private.is_active_user(auth.uid()));
drop policy if exists "purchase_orders_write" on public.purchase_orders;
create policy "purchase_orders_write" on public.purchase_orders for all to authenticated
  using (app_private.has_any_role(auth.uid(), array['dono','gerente','secretaria']::public.app_role[]))
  with check (app_private.has_any_role(auth.uid(), array['dono','gerente','secretaria']::public.app_role[]));

-- Approvals
drop policy if exists "approvals_select" on public.approvals;
create policy "approvals_select" on public.approvals for select to authenticated using (app_private.is_active_user(auth.uid()));
drop policy if exists "approvals_insert" on public.approvals;
create policy "approvals_insert" on public.approvals for insert to authenticated
  with check (app_private.has_any_role(auth.uid(), array['dono','gerente','secretaria','mecanico']::public.app_role[]));
drop policy if exists "approvals_update" on public.approvals;
create policy "approvals_update" on public.approvals for update to authenticated
  using (app_private.has_role(auth.uid(), required_role))
  with check (app_private.has_role(auth.uid(), required_role) and decided_by = auth.uid());

-- Payments
drop policy if exists "payments_select" on public.payments;
create policy "payments_select" on public.payments for select to authenticated
  using (app_private.has_any_role(auth.uid(), array['dono','gerente','contabilidade','secretaria']::public.app_role[]));
drop policy if exists "payments_insert" on public.payments;
create policy "payments_insert" on public.payments for insert to authenticated
  with check (app_private.has_any_role(auth.uid(), array['dono','gerente','contabilidade','secretaria']::public.app_role[]));
drop policy if exists "payments_update" on public.payments;
create policy "payments_update" on public.payments for update to authenticated
  using (app_private.has_any_role(auth.uid(), array['dono','gerente','contabilidade']::public.app_role[]));
drop policy if exists "payments_delete" on public.payments;
create policy "payments_delete" on public.payments for delete to authenticated
  using (app_private.has_role(auth.uid(), 'dono'::public.app_role));

-- Expenses
drop policy if exists "expenses_select" on public.expenses;
create policy "expenses_select" on public.expenses for select to authenticated
  using (app_private.has_any_role(auth.uid(), array['dono','gerente','contabilidade']::public.app_role[]));
drop policy if exists "expenses_write" on public.expenses;
create policy "expenses_write" on public.expenses for all to authenticated
  using (app_private.has_any_role(auth.uid(), array['dono','gerente','contabilidade']::public.app_role[]))
  with check (app_private.has_any_role(auth.uid(), array['dono','gerente','contabilidade']::public.app_role[]));

-- Audit Log
drop policy if exists "audit_log_select" on public.audit_log;
create policy "audit_log_select" on public.audit_log for select to authenticated using (app_private.is_manager(auth.uid()));
drop policy if exists "audit_log_insert" on public.audit_log;
create policy "audit_log_insert" on public.audit_log for insert to authenticated with check (user_id = auth.uid());

-- 10. TRIGGER DE UPDATED_AT
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists service_orders_touch on public.service_orders;
create trigger service_orders_touch before update on public.service_orders
  for each row execute function public.touch_updated_at();

-- 11. REALTIME PARA ATUALIZAÇÕES AO VIVO
alter table public.service_orders replica identity full;
do $$ begin
  begin
    alter publication supabase_realtime add table public.service_orders;
  exception when duplicate_object then null;
  end;
end $$;

-- 12. STORAGE BUCKET PARA FOTOS
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'oficina-media',
  'oficina-media',
  true,
  52428800,
  array['image/jpeg','image/png','image/webp','image/heic','video/mp4','application/pdf']
)
on conflict (id) do nothing;

-- Políticas do storage
drop policy if exists "oficina_media_select" on storage.objects;
create policy "oficina_media_select" on storage.objects for select to authenticated
  using (bucket_id = 'oficina-media' and app_private.is_active_user(auth.uid()));

drop policy if exists "oficina_media_insert" on storage.objects;
create policy "oficina_media_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'oficina-media' and app_private.is_active_user(auth.uid()));

drop policy if exists "oficina_media_delete" on storage.objects;
create policy "oficina_media_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'oficina-media' and (owner = auth.uid() or app_private.is_manager(auth.uid())));

-- 13. PERMISSÕES PADRÃO POR FUNÇÃO
insert into public.role_permissions (role, permission, allowed) values
  ('dono','gerenciar_usuarios',true),
  ('dono','aprovar_orcamento',true),
  ('dono','aprovar_compra',true),
  ('dono','ver_financeiro',true),
  ('dono','lancar_diagnostico',true),
  ('dono','cadastrar_os',true),
  ('gerente','aprovar_orcamento',true),
  ('gerente','aprovar_compra',true),
  ('gerente','ver_financeiro',true),
  ('gerente','cadastrar_os',true),
  ('gerente','gerenciar_usuarios',false),
  ('secretaria','cadastrar_os',true),
  ('secretaria','aprovar_compra',false),
  ('secretaria','ver_financeiro',false),
  ('mecanico','lancar_diagnostico',true),
  ('mecanico','ver_financeiro',false),
  ('contabilidade','ver_financeiro',true),
  ('contabilidade','cadastrar_os',false),
  ('funcionario','cadastrar_os',false)
on conflict (role, permission) do update set allowed = excluded.allowed;

-- ============================================================
-- FIM DO SCRIPT
-- Se você chegou aqui sem erros, o banco está pronto!
-- Próximos passos:
-- 1. Configure as variáveis de ambiente na Vercel (veja abaixo)
-- 2. Acesse o sistema e faça o primeiro login para criar o dono
-- ============================================================
