# Coffre numérique

Appli de gestion des contacts (perso, travail, sociétés, artisans) et des
documents administratifs de la famille, partagée entre plusieurs comptes,
avec synchronisation en temps réel (Next.js + Supabase + Vercel).

Suis les étapes dans l'ordre. Compte environ 20-30 minutes la première fois
(un peu plus si tu pars d'une base neuve, moins si tu as déjà un projet
Supabase pour une autre appli comme Budget famille).

## 1. Créer le projet Supabase (ou réutiliser l'existant)

Tu peux soit créer un nouveau projet Supabase dédié, soit réutiliser le même
projet que ton appli Budget famille : grâce au schéma dédié `coffre`, les
deux applis cohabitent sans se marcher dessus.

1. Va sur https://supabase.com, crée un projet (ou ouvre celui existant).
2. Si nouveau projet : choisis un nom (ex: `coffre-numerique`), un mot de
   passe de base de données, une région proche de toi (`eu-west`).

## 2. Créer les tables, la sécurité et le stockage

1. Dans le menu de gauche, ouvre **SQL Editor**.
2. Ouvre le fichier `supabase/schema.sql` de ce projet, copie tout son
   contenu, colle-le dans l'éditeur SQL Supabase, puis clique **Run**.
   Ce script crée :
   - le schéma `coffre` et ses 5 tables (`family_members`, `contact_types`,
     `document_types`, `contacts`, `documents`)
   - les policies de sécurité (RLS) : seuls des comptes authentifiés peuvent
     lire/écrire
   - un bucket de stockage privé `coffre-documents` pour les fichiers
     (cartes d'identité, permis...), avec ses propres policies
   - les données de départ : tes 5 membres (Virginie, Lionel, Candice,
     Amandine, Julia) et les types de contact/document demandés
3. Vérifie dans **Table Editor** (sélectionne le schéma **coffre** en haut)
   que les 5 tables sont bien là, avec les données de départ.
4. Ouvre **Project Settings > API**, section **Exposed schemas**, ajoute
   `coffre` à la liste (garde `public`/`budget` si tu as d'autres projets
   dessus), puis **Save**. Sans cette étape (et sans le Save !), l'appli ne
   trouvera pas ses tables.

## 3. Créer vos comptes

Pas d'inscription publique — vous créez vos comptes vous-même :

1. Dans le menu de gauche, ouvre **Authentication > Users**.
2. Clique **Add user > Create new user**.
3. Renseigne l'email et un mot de passe. Coche **Auto Confirm User**.
4. Répète pour chaque personne devant y avoir accès.

Si tu réutilises le projet Supabase de Budget famille, les comptes existent
déjà — inutile de les recréer.

## 4. Récupérer les clés API

1. Dans le menu de gauche, ouvre **Project Settings > API**.
2. Note **Project URL** et la clé **anon public**.
3. Duplique `.env.local.example` en `.env.local`, et colle-y ces deux
   valeurs (les mêmes que pour Budget famille si même projet Supabase).

## 5. Déployer sur Vercel

1. Mets ce projet sur GitHub (nouveau dépôt, pousse ces fichiers).
2. Va sur https://vercel.com, **Add New > Project**, choisis ton dépôt.
3. Avant **Deploy**, ouvre **Environment Variables** et ajoute :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Clique **Deploy**. Après 1-2 minutes, tu as une URL du type
   `coffre-numerique.vercel.app`.

## 6. Utilisation au quotidien

- **Contacts** : ajout/édition/suppression, recherche en direct (nom,
  société, téléphone, email), filtres par type et par membre de la famille,
  tri alphabétique automatique.
- **Documents** : un document par pièce (libellé, date du document, date de
  fin de validité, fichier), rattaché à un membre ou à "Général". Une pastille
  orange/rouge signale les documents bientôt expirés ou déjà expirés.
- **Paramétrage** : gère les membres de la famille, les types de contact
  (avec couleur) et les types de document — ajout, renommage, suppression
  (bloquée si encore utilisée quelque part).
- **Import de contacts** : dans Paramétrage, charge un fichier `.vcf` exporté
  depuis ton téléphone :
  - **Android** : appli Contacts > Paramètres > Exporter vers un fichier .vcf
  - **iPhone** : via iCloud.com (Contacts > sélectionner tout > Exporter
    vCard) ou en partageant un contact au format vCard
  L'appli te montre un aperçu de chaque contact trouvé, tu choisis le type et
  le membre concerné (au cas par cas ou en bloc), puis tu valides l'import.
  Rien n'est enregistré tant que tu n'as pas cliqué sur "Importer".
- Toute modification apparaît quasi instantanément chez les autres comptes
  connectés, grâce au temps réel Supabase.
