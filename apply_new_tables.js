import pg from 'pg';
import { fileURLToPath } from 'url';

const { Client } = pg;

const DB_URL = `postgresql://postgres.hhzwepqlbkciilolychj:HARDware1108!@aws-0-ca-central-1.pooler.supabase.com:6543/postgres`;

const steps = [
  // Appointments table
  `create table if not exists public.appointments (
    id uuid primary key default gen_random_uuid(),
    client_name text not null,
    plate text,
    service text,
    mechanic_id uuid references auth.users(id) on delete set null,
    scheduled_at timestamptz not null,
    notes text,
    status text not null default 'agendado',
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now()
  );`,
  `alter table public.appointments enable row level security;`,
  `drop policy if exists "appointments_all" on public.appointments;
   create policy "appointments_all" on public.appointments
     for all to authenticated
     using (app_private.is_active_user(auth.uid()))
     with check (app_private.is_active_user(auth.uid()));`,
  `grant select, insert, update, delete on public.appointments to authenticated;
   grant all on public.appointments to service_role;`,
  `create index if not exists idx_appointments_scheduled on public.appointments(scheduled_at);`,

  // Edit requests table (for requesting to edit a completed OS stage)
  `create table if not exists public.edit_requests (
    id uuid primary key default gen_random_uuid(),
    service_order_id uuid not null references public.service_orders(id) on delete cascade,
    stage text not null,
    reason text,
    status text not null default 'pendente',
    requested_by uuid references auth.users(id) on delete set null,
    reviewed_by uuid references auth.users(id) on delete set null,
    reviewed_at timestamptz,
    created_at timestamptz not null default now()
  );`,
  `alter table public.edit_requests enable row level security;`,
  `drop policy if exists "edit_requests_all" on public.edit_requests;
   create policy "edit_requests_all" on public.edit_requests
     for all to authenticated
     using (app_private.is_active_user(auth.uid()))
     with check (app_private.is_active_user(auth.uid()));`,
  `grant select, insert, update, delete on public.edit_requests to authenticated;
   grant all on public.edit_requests to service_role;`,

  // Add created_by column to service_orders if missing (safe)
  `do $$ begin
     alter table public.service_orders add column if not exists created_by uuid references auth.users(id) on delete set null;
   exception when others then null;
   end $$;`,
];

async function run() {
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  try {
    console.log('🔌 Conectando...');
    await client.connect();
    console.log('✅ Conectado!\n');

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const preview = step.replace(/\s+/g, ' ').slice(0, 80);
      try {
        await client.query(step);
        console.log(`✅ [${i+1}/${steps.length}] ${preview}...`);
      } catch (err) {
        if (err.code === '42710' || err.code === '42P07' || err.code === '23505' || err.code === '42701') {
          console.log(`⏭️  [${i+1}/${steps.length}] já existe — ${preview}...`);
        } else {
          console.error(`\n❌ ERRO no passo ${i+1}: ${err.message}`);
          process.exit(1);
        }
      }
    }

    console.log('\n🎉 Tabelas criadas com sucesso!');
  } finally {
    await client.end();
  }
}

run();
