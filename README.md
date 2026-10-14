# VIBE CHECK par Elvidio

Starter React + Vite mobile-first : quiz, défis quotidiens, boutique d'XP, classement, profil. Backend Supabase (session anonyme + RPC).

## Lancer le projet

1. Copie `.env.example` vers `.env` et renseigne l'URL Supabase et la clé publique `anon`/publishable.
2. `npm install` puis `npm run dev` (build : `npm run build`).

Ne mets jamais de clé `service_role` dans le frontend. `.env` est ignoré par git (`.gitignore`).

## Mise en place Supabase (dans cet ordre)

1. **Authentication → Providers** : active *Anonymous Sign-Ins*.
2. **Authentication → Attack Protection** : active un **captcha** (Turnstile ou hCaptcha) et garde des limites de connexion strictes. C'est la protection contre la création de comptes en masse pour tricher au classement.
3. **SQL Editor** : exécute `supabase/audit_quiz_rpc.sql` et relis les résultats (voir ci-dessous).
4. **SQL Editor** : exécute `supabase/migrations/20261014_vibe_player_system.sql`, puis `supabase/migrations/20261015_vibe_hardening.sql`. Les deux sont réexécutables.

### Ce que fait la migration de durcissement (v11)
- Les XP des missions `quiz` et `perfect` sont attribués **uniquement par le serveur**, via `vibe_submit_quiz`, qui appelle `submit_public_quiz` et lit le score qu'elle renvoie. Le client ne peut plus réclamer ces missions directement.
- Le bonus de 50 XP pour 3 missions terminées est maintenant réellement attribué (une fois par jour).
- Pseudos : validés (3 à 24 caractères), uniques, réservés pour certains noms. Un pseudo aléatoire (ex. `Joueur4821`) est créé à la première connexion et n'est plus écrasé. Changement via `vibe_set_pseudo`.
- Classement : basé sur les XP **gagnés** (acheter un objet ne fait plus perdre de rang). Jour et semaine en UTC. Les joueurs à 0 XP sur la période sont masqués.

### Point à vérifier : `audit_quiz_rpc.sql`
`get_public_quiz` et `submit_public_quiz` ne sont pas dans ce dépôt. Vérifie que :
- `get_public_quiz` ne renvoie **pas** les bonnes réponses ;
- `submit_public_quiz` accepte `(p_slug, p_participant_name, p_answers)` et renvoie `score` (ou `correct_answers`) et `total_questions`. `vibe_submit_quiz` s'appuie sur ces noms ; s'ils diffèrent, adapte l'extraction du score dans la migration.

## Limites connues
- La mission `explore` (25 XP/jour) ne peut pas être vérifiée côté serveur ; elle est plafonnée à une fois par jour et par compte. Le captcha limite l'abus par comptes multiples.
- Comptes anonymes : si les données du navigateur sont effacées, le compte est perdu. Pas encore de compte récupérable par email.
- Le classement affiche le Top 10 ; les streams, abonnés et certains badges du profil restent des aperçus de démonstration.
- Code : la logique Supabase est dans `src/api.js`, les données de démo dans `src/data.js`. `App.jsx` reste volumineux et pourrait être découpé en écrans.
