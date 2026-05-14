-- Ekip Panosu - Supabase SQL
-- Supabase > SQL Editor'e yapıştır ve "Run" a bas

create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text not null default 'todo' check (status in ('todo','doing','done')),
  priority text not null default 'mid' check (priority in ('low','mid','high')),
  assignee text not null default '',
  tags text[] default '{}',
  notes jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Realtime aktif et
alter publication supabase_realtime add table tasks;

-- Herkes okuyup yazabilsin (ekip içi kullanım için)
alter table tasks enable row level security;
create policy "Herkes okuyabilir" on tasks for select using (true);
create policy "Herkes ekleyebilir" on tasks for insert with check (true);
create policy "Herkes güncelleyebilir" on tasks for update using (true);
create policy "Herkes silebilir" on tasks for delete using (true);

-- Demo veriler
insert into tasks (title, status, priority, assignee, tags) values
  ('Mobil tasarım revizyonu', 'todo', 'high', 'FŞ', '{"tasarım"}'),
  ('API entegrasyonu', 'doing', 'mid', 'BY', '{"backend"}'),
  ('Landing page güncelleme', 'todo', 'mid', 'AK', '{"frontend"}'),
  ('Onboarding akışı', 'doing', 'high', 'MÇ', '{"ürün"}'),
  ('Kullanıcı araştırması raporu', 'done', 'low', 'ZD', '{"araştırma"}');
