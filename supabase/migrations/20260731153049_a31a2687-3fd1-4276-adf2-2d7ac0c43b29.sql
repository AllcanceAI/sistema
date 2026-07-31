-- ENUMS
create type public.app_role as enum ('dono','gerente','secretaria','mecanico','contabilidade','funcionario');
create type public.os_mode as enum ('express','analise');
create type public.os_status as enum ('recebido','checklist','diagnostico','orcamento','aguardando_aprovacao','aprovado','compra_pecas','em_execucao','concluido','entregue','cancelado');
create type public.media_stage as enum ('entrada','checklist','defeito','peca_nova','servico_concluido','outro');
create type public.approval_stage as enum ('orcamento','compra_pecas','execucao','entrega');
create type public.approval_decision as enum ('pendente','aprovado','reprovado');
create type public.client_kind as enum ('pessoa','empresa');
create type public.checklist_kind as enum ('entrada','diagnostico');
create type public.check_state as enum ('ok','atencao','critico','na');

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  job_title text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- USER ROLES
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_active_user(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = _user_id and active)
$$;

create or replace function public.has_any_role(_user_id uuid, _roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = any(_roles))
$$;

create or replace function public.is_manager(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_any_role(_user_id, array['dono','gerente']::public.app_role[])
$$;

-- ROLE PERMISSIONS
create table public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role public.app_role not null,
  permission text not null,
  allowed boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (role, permission)
);
grant select on public.role_permissions to authenticated;
grant all on public.role_permissions to service_role;
alter table public.role_permissions enable row level security;

-- COMPANIES
create table public.companies (
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
grant select, insert, update, delete on public.companies to authenticated;
grant all on public.companies to service_role;
alter table public.companies enable row level security;

-- CLIENTS
create table public.clients (
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
grant select, insert, update, delete on public.clients to authenticated;
grant all on public.clients to service_role;
alter table public.clients enable row level security;

-- VEHICLES
create table public.vehicles (
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
create unique index vehicles_plate_key on public.vehicles (upper(plate));
grant select, insert, update, delete on public.vehicles to authenticated;
grant all on public.vehicles to service_role;
alter table public.vehicles enable row level security;

-- SERVICE ORDERS
create sequence public.service_order_number_seq;
create table public.service_orders (
  id uuid primary key default gen_random_uuid(),
  number int not null default nextval('public.service_order_number_seq'),
  mode public.os_mode not null,
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
grant select, insert, update, delete on public.service_orders to authenticated;
grant all on public.service_orders to service_role;
alter table public.service_orders enable row level security;

-- CHECKLISTS
create table public.checklists (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  kind public.checklist_kind not null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.checklists to authenticated;
grant all on public.checklists to service_role;
alter table public.checklists enable row level security;

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklists(id) on delete cascade,
  label text not null,
  state public.check_state not null default 'na',
  note text,
  position int not null default 0
);
grant select, insert, update, delete on public.checklist_items to authenticated;
grant all on public.checklist_items to service_role;
alter table public.checklist_items enable row level security;

-- MEDIA
create table public.media (
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
grant select, insert, update, delete on public.media to authenticated;
grant all on public.media to service_role;
alter table public.media enable row level security;

-- QUOTES
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  labor_total numeric(12,2) not null default 0,
  parts_total numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.quotes to authenticated;
grant all on public.quotes to service_role;
alter table public.quotes enable row level security;

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  description text not null,
  kind text not null default 'peca',
  quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0
);
grant select, insert, update, delete on public.quote_items to authenticated;
grant all on public.quote_items to service_role;
alter table public.quote_items enable row level security;

-- PURCHASE ORDERS
create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  supplier text,
  description text,
  total numeric(12,2) not null default 0,
  status text not null default 'pendente',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.purchase_orders to authenticated;
grant all on public.purchase_orders to service_role;
alter table public.purchase_orders enable row level security;

-- APPROVALS
create table public.approvals (
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
grant select, insert, update, delete on public.approvals to authenticated;
grant all on public.approvals to service_role;
alter table public.approvals enable row level security;

-- AUDIT LOG
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);
grant select, insert on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger service_orders_touch before update on public.service_orders for each row execute function public.touch_updated_at();

-- POLICIES
-- profiles
create policy "profiles_select_own" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles_select_staff" on public.profiles for select to authenticated using (public.is_active_user(auth.uid()));
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and active = (select p.active from public.profiles p where p.id = auth.uid()));
create policy "profiles_manage_owner" on public.profiles for all to authenticated using (public.has_role(auth.uid(),'dono')) with check (public.has_role(auth.uid(),'dono'));

-- user_roles
create policy "user_roles_select" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.is_manager(auth.uid()));

-- role_permissions
create policy "role_permissions_select" on public.role_permissions for select to authenticated using (public.is_active_user(auth.uid()));

-- generic staff policies
create policy "companies_select" on public.companies for select to authenticated using (public.is_active_user(auth.uid()));
create policy "companies_write" on public.companies for all to authenticated using (public.has_any_role(auth.uid(), array['dono','gerente','secretaria']::public.app_role[])) with check (public.has_any_role(auth.uid(), array['dono','gerente','secretaria']::public.app_role[]));

create policy "clients_select" on public.clients for select to authenticated using (public.is_active_user(auth.uid()));
create policy "clients_write" on public.clients for all to authenticated using (public.has_any_role(auth.uid(), array['dono','gerente','secretaria']::public.app_role[])) with check (public.has_any_role(auth.uid(), array['dono','gerente','secretaria']::public.app_role[]));

create policy "vehicles_select" on public.vehicles for select to authenticated using (public.is_active_user(auth.uid()));
create policy "vehicles_write" on public.vehicles for all to authenticated using (public.has_any_role(auth.uid(), array['dono','gerente','secretaria']::public.app_role[])) with check (public.has_any_role(auth.uid(), array['dono','gerente','secretaria']::public.app_role[]));

create policy "service_orders_select" on public.service_orders for select to authenticated using (public.is_active_user(auth.uid()));
create policy "service_orders_insert" on public.service_orders for insert to authenticated with check (public.has_any_role(auth.uid(), array['dono','gerente','secretaria']::public.app_role[]));
create policy "service_orders_update" on public.service_orders for update to authenticated using (public.has_any_role(auth.uid(), array['dono','gerente','secretaria']::public.app_role[]) or mechanic_id = auth.uid()) with check (public.has_any_role(auth.uid(), array['dono','gerente','secretaria']::public.app_role[]) or mechanic_id = auth.uid());
create policy "service_orders_delete" on public.service_orders for delete to authenticated using (public.is_manager(auth.uid()));

create policy "checklists_select" on public.checklists for select to authenticated using (public.is_active_user(auth.uid()));
create policy "checklists_write" on public.checklists for all to authenticated using (public.has_any_role(auth.uid(), array['dono','gerente','secretaria','mecanico']::public.app_role[])) with check (public.has_any_role(auth.uid(), array['dono','gerente','secretaria','mecanico']::public.app_role[]));

create policy "checklist_items_select" on public.checklist_items for select to authenticated using (public.is_active_user(auth.uid()));
create policy "checklist_items_write" on public.checklist_items for all to authenticated using (public.has_any_role(auth.uid(), array['dono','gerente','secretaria','mecanico']::public.app_role[])) with check (public.has_any_role(auth.uid(), array['dono','gerente','secretaria','mecanico']::public.app_role[]));

create policy "media_select" on public.media for select to authenticated using (public.is_active_user(auth.uid()));
create policy "media_insert" on public.media for insert to authenticated with check (public.is_active_user(auth.uid()) and created_by = auth.uid());
create policy "media_delete" on public.media for delete to authenticated using (created_by = auth.uid() or public.is_manager(auth.uid()));

create policy "quotes_select" on public.quotes for select to authenticated using (public.is_active_user(auth.uid()));
create policy "quotes_write" on public.quotes for all to authenticated using (public.has_any_role(auth.uid(), array['dono','gerente','secretaria','mecanico']::public.app_role[])) with check (public.has_any_role(auth.uid(), array['dono','gerente','secretaria','mecanico']::public.app_role[]));

create policy "quote_items_select" on public.quote_items for select to authenticated using (public.is_active_user(auth.uid()));
create policy "quote_items_write" on public.quote_items for all to authenticated using (public.has_any_role(auth.uid(), array['dono','gerente','secretaria','mecanico']::public.app_role[])) with check (public.has_any_role(auth.uid(), array['dono','gerente','secretaria','mecanico']::public.app_role[]));

create policy "purchase_orders_select" on public.purchase_orders for select to authenticated using (public.is_active_user(auth.uid()));
create policy "purchase_orders_write" on public.purchase_orders for all to authenticated using (public.has_any_role(auth.uid(), array['dono','gerente','secretaria']::public.app_role[])) with check (public.has_any_role(auth.uid(), array['dono','gerente','secretaria']::public.app_role[]));

create policy "approvals_select" on public.approvals for select to authenticated using (public.is_active_user(auth.uid()));
create policy "approvals_insert" on public.approvals for insert to authenticated with check (public.has_any_role(auth.uid(), array['dono','gerente','secretaria','mecanico']::public.app_role[]));
create policy "approvals_update" on public.approvals for update to authenticated using (public.has_role(auth.uid(), required_role)) with check (public.has_role(auth.uid(), required_role) and decided_by = auth.uid());

create policy "audit_log_select" on public.audit_log for select to authenticated using (public.is_manager(auth.uid()));
create policy "audit_log_insert" on public.audit_log for insert to authenticated with check (user_id = auth.uid());

-- SEED default permissions
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
('funcionario','cadastrar_os',false);