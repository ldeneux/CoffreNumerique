-- Migration : ajoute la date de naissance des membres de la famille,
-- nécessaire pour le calendrier vaccinal (calcul de l'âge par vaccin).
-- À exécuter une seule fois dans Supabase > SQL Editor.

alter table coffre.family_members add column if not exists date_naissance date;
