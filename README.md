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
   que les tables sont bien là, avec les données de départ (`activities`,
   `vaccinations` et les colonnes `alias`/`numero_urgence`/`epingle` sur
   `contacts` sont inclus si tu pars du `schema.sql` à jour ; sur une base
   existante, lance en plus les fichiers `supabase/migration_*.sql`, un par
   un, dans le SQL Editor).
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

## 6. Carnet de santé : lecture automatique d'un scan (optionnel)

L'onglet **Santé** permet de saisir un carnet de vaccination à la main, et
propose en plus un bouton **Importer un scan** qui utilise l'API Gemini pour
pré-remplir les lignes (vaccin / date / lot / dose) à partir d'une photo ou
d'un PDF — à relire et corriger avant tout enregistrement, rien n'est jamais
ajouté automatiquement.

Cette partie est optionnelle : sans la configurer, l'onglet Santé fonctionne
normalement en saisie manuelle, seul le bouton "Importer un scan" renverra
une erreur explicite.

1. Récupère une clé API Gemini gratuite sur https://aistudio.google.com/apikey
   (avec ton compte Google existant).
2. Installe la CLI Supabase si besoin :
   `npm install -g supabase` (ou voir https://supabase.com/docs/guides/cli).
3. Depuis la racine de ce projet, connecte-toi et relie le projet :
   ```
   supabase login
   supabase link --project-ref <ton-project-ref>
   ```
   (le `project-ref` est dans l'URL du projet Supabase, ou dans
   Project Settings > General).
4. Ajoute ta clé comme secret de la fonction, sans jamais la mettre dans le
   code ni dans `.env.local` :
   ```
   supabase secrets set GEMINI_API_KEY=colle-ta-cle-ici
   ```
5. Déploie la fonction :
   ```
   supabase functions deploy extract-health-record
   ```
6. C'est tout : le bouton "Importer un scan" de l'onglet Santé fonctionne
   désormais. Si tu veux le désactiver plus tard, il suffit de ne plus
   redéployer la fonction ou de retirer le secret.

**Sur la confidentialité** : le tier gratuit de l'API Gemini peut, par
défaut, réutiliser les données envoyées pour améliorer les modèles Google —
contrairement au tier payant ou à Vertex AI. Comme il s'agit de données de
santé d'enfants, vérifie les conditions actuelles de Google avant d'envoyer
de vrais scans, et passe sur un tier payant/Vertex AI si tu veux l'exclure
formellement.

## 7. Utilisation au quotidien

- **Contacts** : ajout/édition/suppression, recherche en direct (nom,
  société, téléphone, email), filtres par type et par membre de la famille,
  tri alphabétique automatique.
- **Documents** : un document par pièce (libellé, date du document, date de
  fin de validité, fichier), rattaché à un membre ou à "Général". Une pastille
  orange/rouge signale les documents bientôt expirés ou déjà expirés.
- **Paramétrage** : gère les membres de la famille, les types de contact
  (avec couleur), les activités, et les types de document — ajout,
  renommage, suppression (bloquée si encore utilisée quelque part). Les
  membres de la famille et les types de document ont en plus un emoji au
  choix (clique sur le bouton emoji à gauche du nom) : il s'affiche ensuite
  partout où le nom apparaît (listes, filtres, menus déroulants), et pour les
  documents il remplace l'icône générique dans la liste.
- **Import de contacts** : dans Paramétrage, charge un fichier `.vcf` exporté
  depuis ton téléphone :
  - **Android** : appli Contacts > Paramètres > Exporter vers un fichier .vcf
  - **iPhone** : via iCloud.com (Contacts > sélectionner tout > Exporter
    vCard) ou en partageant un contact au format vCard
  L'appli te montre un aperçu de chaque contact trouvé, tu choisis le type et
  le membre concerné (au cas par cas ou en bloc), puis tu valides l'import.
  Rien n'est enregistré tant que tu n'as pas cliqué sur "Importer".
- **Numéros d'urgence / Contacts épinglés** : sur une fiche contact, les
  icônes ⚠️ et 📌 (à côté de l'étoile favori) marquent un contact comme
  numéro d'urgence ou comme épinglé. Les contacts marqués apparaissent dans
  un raccourci sous le menu (nom/prénom uniquement) ; un clic affiche et
  copie le numéro (mobile, sinon fixe), et le libellé revient tout seul au
  bout de 5 secondes.
- **Santé** : carnet de vaccination par membre de la famille, saisie manuelle
  ou import assisté d'un scan (voir section 6 ci-dessus).
- Toute modification apparaît quasi instantanément chez les autres comptes
  connectés, grâce au temps réel Supabase.
