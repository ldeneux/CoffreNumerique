-- Migration : ajoute une colonne "emoji" sur les membres de la famille et
-- sur les types de document, et initialise les emojis des types de document
-- déjà présents dans votre base (d'après votre liste actuelle).
-- À exécuter une seule fois dans Supabase > SQL Editor.

set search_path to coffre, public;

alter table coffre.family_members add column if not exists emoji text;
alter table coffre.document_types add column if not exists emoji text;

-- Initialisation à partir de votre liste actuelle de types de document.
-- Sans effet sur un nom que vous n'avez pas : ajustez/ajoutez des lignes au
-- besoin, ou changez l'emoji ensuite depuis Paramétrage > Types de document.
update coffre.document_types set emoji = '🪪' where name = 'Carte d''identité' and emoji is null;
update coffre.document_types set emoji = '🚘' where name = 'Permis de conduire' and emoji is null;
update coffre.document_types set emoji = '🚗' where name = 'Carte grise' and emoji is null;
update coffre.document_types set emoji = '🏠' where name = 'Justificatif de domicile' and emoji is null;
update coffre.document_types set emoji = '🛂' where name = 'Passeport' and emoji is null;
update coffre.document_types set emoji = '💉' where name = 'Carnet de santé' and emoji is null;
update coffre.document_types set emoji = '📜' where name = 'Attestation' and emoji is null;
update coffre.document_types set emoji = '📋' where name = 'Etat civil' and emoji is null;
update coffre.document_types set emoji = '🎓' where name = 'Diplôme' and emoji is null;
update coffre.document_types set emoji = '🧾' where name = 'Facture pour assurances' and emoji is null;
update coffre.document_types set emoji = '🏦' where name = 'Banque' and emoji is null;
update coffre.document_types set emoji = '✝️' where name = 'Livret catholique' and emoji is null;
update coffre.document_types set emoji = '💶' where name = 'Imposition' and emoji is null;

-- Les membres de la famille n'ont pas d'emoji par défaut : choisissez-les
-- vous-même depuis Paramétrage > Membres de la famille (palette élargie
-- avec animaux et fantaisie pour cette liste-là uniquement).
