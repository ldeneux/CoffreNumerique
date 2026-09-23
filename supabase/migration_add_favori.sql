-- Migration : ajoute la colonne "favori" aux contacts (pour l'onglet Événements)
-- À exécuter une seule fois dans Supabase > SQL Editor si votre base "coffre"
-- existe déjà (schema.sql à jour la crée directement pour une base neuve).

alter table coffre.contacts add column if not exists favori boolean not null default false;
