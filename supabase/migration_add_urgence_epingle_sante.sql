-- Migration : ajoute les numéros d'urgence, les contacts épinglés, et le
-- carnet de santé (vaccinations).
-- À exécuter une seule fois dans Supabase > SQL Editor si votre base "coffre"
-- existe déjà (schema.sql à jour crée tout directement pour une base neuve).

set search_path to coffre, public;

-- 1) Contacts : deux nouveaux drapeaux, indépendants du favori existant.
alter table coffre.contacts add column if not exists numero_urgence boolean not null default false;
alter table coffre.contacts add column if not exists epingle boolean not null default false;

-- 2) Carnet de vaccination
create table if not exists coffre.vaccinations (
  id uuid primary key default gen_random_uuid(),
  family_member_id uuid not null references coffre.family_members(id) on delete cascade,
  vaccine_name text not null,
  date_administered date,
  lot_number text,
  dose_label text,
  source_document_id uuid references coffre.documents(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

alter table coffre.vaccinations enable row level security;

create policy "authenticated can read vaccinations" on coffre.vaccinations for select using (auth.role() = 'authenticated');
create policy "authenticated can write vaccinations" on coffre.vaccinations for insert with check (auth.role() = 'authenticated');
create policy "authenticated can update vaccinations" on coffre.vaccinations for update using (auth.role() = 'authenticated');
create policy "authenticated can delete vaccinations" on coffre.vaccinations for delete using (auth.role() = 'authenticated');

alter publication supabase_realtime add table coffre.vaccinations;

grant all on coffre.vaccinations to authenticated;
grant select on coffre.vaccinations to anon;
