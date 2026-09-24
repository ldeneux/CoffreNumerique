-- Schéma pour l'appli Coffre numérique (contacts + documents administratifs)
-- À exécuter dans Supabase > SQL Editor (un copier-coller, un clic sur "Run")
--
-- Même principe que l'appli Budget famille : un schéma dédié ("coffre") pour
-- cohabiter proprement avec vos autres projets dans la même base Supabase.

create extension if not exists "pgcrypto";

create schema if not exists coffre;
set search_path to coffre, public;

-- Membres de la famille (pour rattacher un contact/document à une personne,
-- ou les laisser "Général" si family_member_id est NULL)
create table if not exists coffre.family_members (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- Types de contact (Personnel, Travail, Société, Artisan...)
create table if not exists coffre.contact_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default 'stone',
  created_at timestamptz not null default now()
);

-- Activités des contacts (Général, Plombier, Médecin...) : sert de filtre
create table if not exists coffre.activities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default 'stone',
  created_at timestamptz not null default now()
);

-- Types de document (Carte d'identité, Permis de conduire...)
create table if not exists coffre.document_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- Contacts (personnes ou sociétés/artisans)
create table if not exists coffre.contacts (
  id uuid primary key default gen_random_uuid(),
  contact_type_id uuid not null references coffre.contact_types(id) on delete restrict,
  activity_id uuid references coffre.activities(id) on delete restrict,
  family_member_id uuid references coffre.family_members(id) on delete set null,
  nom text,
  prenom text,
  alias text,
  societe text,
  telephone_mobile text,
  telephone_fixe text,
  email text,
  adresse text,
  code_postal text,
  ville text,
  date_naissance date,
  favori boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  constraint contact_has_a_name check (coalesce(nom, '') <> '' or coalesce(societe, '') <> '')
);

-- Documents administratifs (le fichier lui-même est stocké dans Supabase
-- Storage, ici on garde juste le chemin + les métadonnées)
create table if not exists coffre.documents (
  id uuid primary key default gen_random_uuid(),
  document_type_id uuid not null references coffre.document_types(id) on delete restrict,
  family_member_id uuid references coffre.family_members(id) on delete set null,
  libelle text not null,
  date_document date,
  date_fin_validite date,
  file_path text,
  file_name text,
  created_at timestamptz not null default now()
);

-- Sécurité : row level security activée sur toutes les tables.
-- Seuls les comptes authentifiés (créés manuellement, voir README) peuvent lire/écrire.
alter table coffre.family_members enable row level security;
alter table coffre.contact_types enable row level security;
alter table coffre.activities enable row level security;
alter table coffre.document_types enable row level security;
alter table coffre.contacts enable row level security;
alter table coffre.documents enable row level security;

create policy "authenticated can read family_members" on coffre.family_members for select using (auth.role() = 'authenticated');
create policy "authenticated can write family_members" on coffre.family_members for insert with check (auth.role() = 'authenticated');
create policy "authenticated can update family_members" on coffre.family_members for update using (auth.role() = 'authenticated');
create policy "authenticated can delete family_members" on coffre.family_members for delete using (auth.role() = 'authenticated');

create policy "authenticated can read contact_types" on coffre.contact_types for select using (auth.role() = 'authenticated');
create policy "authenticated can write contact_types" on coffre.contact_types for insert with check (auth.role() = 'authenticated');
create policy "authenticated can update contact_types" on coffre.contact_types for update using (auth.role() = 'authenticated');
create policy "authenticated can delete contact_types" on coffre.contact_types for delete using (auth.role() = 'authenticated');

create policy "authenticated can read activities" on coffre.activities for select using (auth.role() = 'authenticated');
create policy "authenticated can write activities" on coffre.activities for insert with check (auth.role() = 'authenticated');
create policy "authenticated can update activities" on coffre.activities for update using (auth.role() = 'authenticated');
create policy "authenticated can delete activities" on coffre.activities for delete using (auth.role() = 'authenticated');

create policy "authenticated can read document_types" on coffre.document_types for select using (auth.role() = 'authenticated');
create policy "authenticated can write document_types" on coffre.document_types for insert with check (auth.role() = 'authenticated');
create policy "authenticated can update document_types" on coffre.document_types for update using (auth.role() = 'authenticated');
create policy "authenticated can delete document_types" on coffre.document_types for delete using (auth.role() = 'authenticated');

create policy "authenticated can read contacts" on coffre.contacts for select using (auth.role() = 'authenticated');
create policy "authenticated can write contacts" on coffre.contacts for insert with check (auth.role() = 'authenticated');
create policy "authenticated can update contacts" on coffre.contacts for update using (auth.role() = 'authenticated');
create policy "authenticated can delete contacts" on coffre.contacts for delete using (auth.role() = 'authenticated');

create policy "authenticated can read documents" on coffre.documents for select using (auth.role() = 'authenticated');
create policy "authenticated can write documents" on coffre.documents for insert with check (auth.role() = 'authenticated');
create policy "authenticated can update documents" on coffre.documents for update using (auth.role() = 'authenticated');
create policy "authenticated can delete documents" on coffre.documents for delete using (auth.role() = 'authenticated');

-- Active le temps réel (pour que tous les comptes voient les mises à jour instantanément)
alter publication supabase_realtime add table coffre.family_members;
alter publication supabase_realtime add table coffre.contact_types;
alter publication supabase_realtime add table coffre.activities;
alter publication supabase_realtime add table coffre.document_types;
alter publication supabase_realtime add table coffre.contacts;
alter publication supabase_realtime add table coffre.documents;

-- Autorise les rôles de l'API à utiliser ce schéma (sans ça PostgREST refuse,
-- même une fois "coffre" ajouté aux "Exposed schemas" du Dashboard).
grant usage on schema coffre to anon, authenticated;
grant all on all tables in schema coffre to authenticated;
grant select on all tables in schema coffre to anon;
alter default privileges in schema coffre grant all on tables to authenticated;

-- Jeu de données de départ : vos 5 membres, et les types demandés.
-- Modifiable ensuite librement depuis l'onglet Paramétrage de l'appli.
insert into coffre.family_members (name) values
  ('Virginie'), ('Lionel'), ('Candice'), ('Amandine'), ('Julia')
on conflict (name) do nothing;

insert into coffre.contact_types (name, color) values
  ('Personnel', 'blue'),
  ('Travail', 'violet'),
  ('Société', 'teal'),
  ('Artisan', 'amber')
on conflict (name) do nothing;

insert into coffre.activities (name, color) values ('Général', 'stone')
on conflict (name) do nothing;

insert into coffre.document_types (name) values
  ('Carte d''identité'),
  ('Permis de conduire'),
  ('Justificatif de domicile'),
  ('Passeport'),
  ('Carnet de santé')
on conflict (name) do nothing;

-- Stockage des fichiers de documents (bucket privé : accessible uniquement
-- aux comptes authentifiés, via l'URL signée générée par l'appli au clic sur
-- "Télécharger").
insert into storage.buckets (id, name, public)
values ('coffre-documents', 'coffre-documents', false)
on conflict (id) do nothing;

create policy "authenticated can read coffre documents storage"
  on storage.objects for select
  using (bucket_id = 'coffre-documents' and auth.role() = 'authenticated');

create policy "authenticated can upload coffre documents storage"
  on storage.objects for insert
  with check (bucket_id = 'coffre-documents' and auth.role() = 'authenticated');

create policy "authenticated can update coffre documents storage"
  on storage.objects for update
  using (bucket_id = 'coffre-documents' and auth.role() = 'authenticated');

create policy "authenticated can delete coffre documents storage"
  on storage.objects for delete
  using (bucket_id = 'coffre-documents' and auth.role() = 'authenticated');

-- Dernière étape, à faire à la main dans le Dashboard (pas en SQL) :
-- Project Settings > API > "Exposed schemas" > ajouter "coffre" à la liste,
-- puis Save.
