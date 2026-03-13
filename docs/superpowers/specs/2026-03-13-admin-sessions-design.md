# Admin Sessions — Design Spec

## Objectif

Ajouter un espace "Sessions" dans l'admin pour mesurer l'adoption de la plateforme par les eleves et permettre d'evaluer/iterer sur les reponses et le prompt IA.

## Migration base de donnees

Ajouter une colonne `score` a la table `answers` pour stocker le score numerique (0-100) en plus du booleen `is_valid` :

```sql
-- supabase/migrations/003_add_score_column.sql
ALTER TABLE answers ADD COLUMN score integer;
```

Mettre a jour `POST /api/submit` pour persister `score` en plus de `is_valid` et `ai_feedback`.

## Pages

### Page 1 — Liste des sessions (`/admin/sessions`)

Page `"use client"` avec fetch dans `useEffect` (meme pattern que `/admin/prompts/page.tsx`).
`export const dynamic = "force-dynamic"`.

**Filtre par sujet (haut de page)**
- Dropdown avec "Tous les sujets" par defaut + tous les codes sujets existants
- Filtre les KPI et le tableau simultanement

**Indicateurs KPI (5 cards)**

| Card | Calcul |
|------|--------|
| Total sessions | `count(submissions)` filtre par sujet si selectionne |
| Eleves uniques | `count(distinct student_name)` |
| Taux de completion | `% submissions ou answer_count = question_count du sujet` |
| Score moyen | `avg(score)` sur toutes les answers ayant un score |
| Sessions aujourd'hui | `count(submissions) where submitted_at > now() - 24h` |

Note : le denominateur pour la completion et les scores est dynamique — base sur le nombre reel de questions du sujet (`questions.count`), pas une valeur fixe.

**Tableau des submissions**

| Colonne | Source |
|---------|--------|
| Eleve | `submissions.student_name` |
| Sujet | `subjects.code` (badge) |
| Reponses | `count(answers) / count(questions du sujet)` |
| Score | `count(answers where is_valid) / count(answers)` |
| Date | `submissions.submitted_at` formate |
| Action | Lien "Voir" → `/admin/sessions/[id]` |

Tri par defaut : `submitted_at DESC`.

### Page 2 — Detail d'une session (`/admin/sessions/[id]`)

Page `"use client"` avec fetch dans `useEffect`.
`export const dynamic = "force-dynamic"`.

**En-tete**
- Lien retour vers `/admin/sessions`
- Nom de l'eleve, code sujet (badge), date de soumission
- Score global : X/N questions validees (N = nombre de questions du sujet)
- Bouton "Modifier le prompt" → ouvre le drawer

**Cards de questions**

Pour chaque question ayant une reponse :
- Intitule de la question (avec numero `display_order`)
- Reponse de l'eleve (texte complet)
- Feedback IA (rendu markdown via `react-markdown`)
- Score numerique (badge couleur : vert >= 50, rouge < 50)
- Badge statut : "Validee" (vert) si `is_valid = true`, "Non validee" (rouge) sinon
- Bouton "Relancer l'evaluation IA" avec etat loading (spinner) pendant l'appel. En cas d'erreur, affiche un message inline. Au succes, met a jour la card en local depuis la reponse API (pas de refetch complet).

**Drawer "Modifier le prompt" (panel lateral droit)**

Composant Sheet de shadcn/ui qui s'ouvre a droite. Trois zones :

*Zone edition :*
- Selecteur de modele IA (gemini-2.5-flash, gemini-2.5-pro, gemini-2.0-flash, gemini-flash-latest)
- Textarea avec le prompt systeme actuel du sujet (pre-rempli)
- Bouton "Tester sur cette session" avec etat loading (spinner + desactivation). Relance l'evaluation IA sur toutes les reponses de la session avec le prompt modifie, affiche les resultats dans le drawer SANS sauvegarder en base

*Zone resultats (visible apres un test) :*
- Pour chaque question : titre condense, score numerique (badge couleur), extrait du feedback
- Score global du test (X/N validees)

*Zone sauvegarde :*
- **Avertissement si le prompt est partage** : si le correcteur est utilise par d'autres sujets, afficher un bandeau d'alerte : "Ce correcteur est utilise par N sujets. La modification affectera tous ces sujets."
- Bouton "Sauvegarder le prompt sur le sujet" (vert) — persiste le prompt + modele modifies sur le correcteur en base, puis met a jour les feedbacks/scores de la session avec les resultats du dernier test
- Bouton desactive si aucun test n'a ete lance
- Etat loading pendant la sauvegarde
- Note explicative : "Met a jour le correcteur et conserve les evaluations actuelles"

**Workflow d'iteration :**
1. Modifier le prompt dans le textarea
2. "Tester sur cette session" → voir les resultats dans le drawer
3. Ajuster le prompt, re-tester (autant de fois que necessaire)
4. "Sauvegarder le prompt sur le sujet" → persiste les changements

**Etats vides et erreurs :**
- Si aucune session n'existe : message "Aucune session pour le moment"
- Si une session n'a aucune reponse : message "Cet eleve n'a pas encore soumis de reponse"
- Erreur de chargement : message d'erreur avec bouton "Reessayer"
- Erreur lors de la reevaluation : message inline sous le bouton concerne

## API Routes

Toutes les routes admin verifient l'authentification via `supabase.auth.getUser()` et retournent 401 si non authentifie (meme pattern que `POST /api/prompt-test`).

### `GET /api/sessions`

Retourne les submissions avec donnees jointes.

**Query params :**
- `subject_id` (optionnel) — filtre par sujet

**Response :**
```json
{
  "sessions": [
    {
      "id": "uuid",
      "student_name": "string",
      "submitted_at": "ISO date",
      "subject": { "id": "uuid", "code": "string", "question_count": 4 },
      "answer_count": 4,
      "valid_count": 3
    }
  ],
  "stats": {
    "total_sessions": 47,
    "unique_students": 32,
    "completion_rate": 78,
    "average_score": 62,
    "today_sessions": 5
  }
}
```

### `GET /api/sessions/[id]`

Retourne le detail complet d'une session.

**Response :**
```json
{
  "id": "uuid",
  "student_name": "string",
  "submitted_at": "ISO date",
  "subject": {
    "id": "uuid",
    "code": "string",
    "prompt_id": "uuid",
    "question_count": 4
  },
  "prompt": {
    "id": "uuid",
    "name": "string",
    "ai_prompt": "string",
    "ai_model": "string",
    "subject_count": 2
  },
  "answers": [
    {
      "id": "uuid",
      "question": {
        "id": "uuid",
        "question_text": "string",
        "display_order": 1,
        "expected_answer_guidelines": "string"
      },
      "student_answer": "string",
      "ai_feedback": "string",
      "score": 72,
      "is_valid": true
    }
  ]
}
```

Note : `prompt.subject_count` est le nombre de sujets utilisant ce correcteur — sert a afficher l'avertissement dans le drawer.

### `POST /api/sessions/[id]/reeval`

Relance l'evaluation IA sur une ou toutes les reponses.

**Body (valide par `reevalSchema` Zod) :**
```json
{
  "answer_id": "uuid | null",
  "prompt_override": "string | null",
  "model_override": "string | null"
}
```

- Si `answer_id` fourni : relance sur cette reponse uniquement
- Si `answer_id` null : relance sur toutes les reponses de la session
- Si `prompt_override` fourni : utilise ce prompt au lieu de celui du sujet (mode test drawer)
- Si `model_override` fourni : utilise ce modele

**Response :**
```json
{
  "results": [
    {
      "answer_id": "uuid",
      "question_text": "string",
      "ai_feedback": "string",
      "is_valid": true,
      "score": 72
    }
  ]
}
```

Si `prompt_override` est null (bouton "Relancer" sur une question individuelle), les resultats sont persistes en base. Si `prompt_override` est fourni (mode test drawer), les resultats ne sont PAS persistes — ils sont retournes pour affichage dans le drawer uniquement.

### `POST /api/sessions/[id]/save-prompt`

Sauvegarde le prompt modifie sur le correcteur et persiste les resultats du dernier test.

**Body (valide par `savePromptSchema` Zod) :**
```json
{
  "prompt_text": "string",
  "model": "string",
  "test_results": [
    { "answer_id": "uuid", "ai_feedback": "string", "score": 72, "is_valid": true }
  ]
}
```

Met a jour le correcteur via `UPDATE` sur la table `prompts` (champs `ai_prompt` et `ai_model`) et ecrit les feedbacks/scores dans la table `answers`.

## Modifications a `src/lib/gemini.ts`

La fonction `analyzeAnswer` doit etre etendue pour accepter des parametres optionnels :
- `promptOverride?: string` — prompt brut a utiliser au lieu de charger depuis la base
- `modelOverride?: string` — modele a utiliser au lieu de celui du correcteur

Signature cible :
```typescript
async function analyzeAnswer(
  subjectId: string,
  questionId: string,
  studentAnswer: string,
  options?: { promptOverride?: string; modelOverride?: string }
): Promise<AnswerFeedback>
```

## Schemas Zod

Ajouter dans `src/lib/schemas/session.ts` :

- `reevalSchema` — validation du body de `POST /api/sessions/[id]/reeval`
- `savePromptSchema` — validation du body de `POST /api/sessions/[id]/save-prompt`

## Types TypeScript

Ajouter dans `src/data/interfaces/types.ts` :

- `SessionListItem` — element du tableau de sessions
- `SessionStats` — indicateurs KPI
- `SessionDetail` — detail complet d'une session
- `ReevalResult` — resultat d'une reevaluation

## Composants

| Composant | Fichier | Role |
|-----------|---------|------|
| `SessionsPage` | `src/app/admin/sessions/page.tsx` | Page liste (client) |
| `SessionStats` | `src/components/admin/session-stats.tsx` | Cards KPI |
| `SessionTable` | `src/components/admin/session-table.tsx` | Tableau filtrable |
| `SessionDetailPage` | `src/app/admin/sessions/[id]/page.tsx` | Page detail (client) |
| `SessionDetail` | `src/components/admin/session-detail.tsx` | Contenu detail |
| `AnswerCard` | `src/components/admin/answer-card.tsx` | Card question/reponse/feedback |
| `PromptDrawer` | `src/components/admin/prompt-drawer.tsx` | Drawer iteration prompt |

## Composant UI additionnel

Ajouter le composant **Sheet** de shadcn/ui pour le drawer :
```bash
npx shadcn@latest add sheet
```

## Navigation

Ajouter "Sessions" dans le `AdminShell` a cote de "Sujets" et "Correcteurs IA".

## Securite

- Toutes les routes `/api/sessions/*` verifient l'auth via `supabase.auth.getUser()` et retournent 401 si non authentifie
- Les routes utilisent le client admin Supabase (service role) pour les requetes — le RLS n'est pas implique pour les UPDATE sur `answers` (admin-only par design)
- Les pages `/admin/sessions/*` sont protegees par le middleware existant
- Pas de donnees sensibles supplementaires exposees (student_name est deja en base)

## Hors scope

- Pagination du tableau (a ajouter si le volume le justifie)
- Export CSV des sessions
- Graphiques d'evolution temporelle
- Correction manuelle par le prof (commentaires)
- Clone-on-write du prompt (pour l'instant on modifie le prompt partage avec avertissement)
