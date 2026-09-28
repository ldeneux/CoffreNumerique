-- Migration : permet de "ne plus signaler" un vaccin pour un membre de la
-- famille dans l'écran Événements (case à cocher dans Santé > Calendrier).
-- À exécuter une seule fois dans Supabase > SQL Editor.

create table if not exists coffre.vaccine_alert_dismissals (
  id uuid primary key default gen_random_uuid(),
  family_member_id uuid not null references coffre.family_members(id) on delete cascade,
  vaccine_id text not null,
  created_at timestamptz not null default now(),
  unique (family_member_id, vaccine_id)
);

alter table coffre.vaccine_alert_dismissals enable row level security;

create policy "authenticated can read vaccine_alert_dismissals" on coffre.vaccine_alert_dismissals for select using (auth.role() = 'authenticated');
create policy "authenticated can write vaccine_alert_dismissals" on coffre.vaccine_alert_dismissals for insert with check (auth.role() = 'authenticated');
create policy "authenticated can update vaccine_alert_dismissals" on coffre.vaccine_alert_dismissals for update using (auth.role() = 'authenticated');
create policy "authenticated can delete vaccine_alert_dismissals" on coffre.vaccine_alert_dismissals for delete using (auth.role() = 'authenticated');

alter publication supabase_realtime add table coffre.vaccine_alert_dismissals;

grant all on coffre.vaccine_alert_dismissals to authenticated;
grant select on coffre.vaccine_alert_dismissals to anon;
