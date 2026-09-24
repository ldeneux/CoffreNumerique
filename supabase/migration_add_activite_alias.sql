-- Migration : ajoute l'"Activité" (liste gérée dans Paramétrage) et l'"Alias" aux contacts.
-- À exécuter une seule fois dans Supabase > SQL Editor si votre base "coffre" existe déjà
-- (schema.sql à jour crée tout directement pour une base neuve).

-- 1) Table des activités (Général, Plombier, Médecin...)
create table if not exists coffre.activities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default 'stone',
  created_at timestamptz not null default now()
);

alter table coffre.activities enable row level security;

create policy "authenticated can read activities" on coffre.activities for select using (auth.role() = 'authenticated');
create policy "authenticated can write activities" on coffre.activities for insert with check (auth.role() = 'authenticated');
create policy "authenticated can update activities" on coffre.activities for update using (auth.role() = 'authenticated');
create policy "authenticated can delete activities" on coffre.activities for delete using (auth.role() = 'authenticated');

alter publication supabase_realtime add table coffre.activities;

grant all on coffre.activities to authenticated;
grant select on coffre.activities to anon;

-- 2) Nouvelles colonnes sur les contacts
alter table coffre.contacts add column if not exists activity_id uuid references coffre.activities(id) on delete restrict;
alter table coffre.contacts add column if not exists alias text;

-- 3) Activité par défaut "Général" (non affichée sur la ligne du contact dans l'appli),
--    appliquée aux contacts existants pour que le filtre "Général" les retrouve.
insert into coffre.activities (name, color) values ('Général', 'stone')
on conflict (name) do nothing;

update coffre.contacts
set activity_id = (select id from coffre.activities where name = 'Général')
where activity_id is null;
