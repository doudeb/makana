# Admin Sessions — Design Spec

## Objectif

Ajouter un espace "Sessions" dans l'admin pour mesurer l'adoption de la plateforme par les eleves et permettre d'evaluer/iterer sur les reponses et le prompt IA.

## Pages

### Page 1 — Liste des sessions (`/admin/sessions`)

Page server component avec client components pour les interactions.

**Filtre par sujet (haut de page)**
- Dropdown avec "Tous les sujets" par defaut + tous les codes sujets existants
- Filtre les KPI et le tableau simultanement

**Indicateurs KPI (5 cards)**

| Card | Calcul |
|------|--------|
| Total sessions | `count(submissions)` filtre par sujet si selectionne |
| Eleves uniques | `count(distinct student_name)` |
| Taux de completion | `% submissions ayant 4 answers` |
| Score moyen | `avg(is_valid::int) * 100` sur toutes les answers |
| Sessions aujourd'hui | `count(submissions) where submitted_at > now() - 24h` |

**Tableau des submissions**

| Colonne | Source |
|---------|--------|
| Eleve | `submissions.student_name` |
| Sujet | `subjects.code` (badge) |
| Reponses | `count(answers) / 4` |
| Score | `count(answers where is_valid) / count(answers)` |
| Date | `submissions.submitted_at` formate |
| Action | Lien "Voir" → `/admin/sessions/[id]` |

Tri par defaut : `submitted_at DESC`.

### Page 2 — Detail d'une session (`/admin/sessions/[id]`)

**En-tete**
- Lien retour vers `/admin/sessions`
- Nom de l'eleve, code sujet (badge), date de soumission
- Score global : X/4 questions validees
- Bouton "Modifier le prompt" → ouvre le drawer

**Cards de questions (1 a 4)**

Pour chaque question ayant une reponse :
- Intitule de la question (avec numero)
- Reponse de l'eleve (texte complet)
- Feedback IA (rendu markdown via `react-markdown`)
- Badge statut : "Validee" (vert) si `is_valid = true`, "Non validee" (rouge) sinon
- Bouton "Relancer l'evaluation IA" — rappelle l'API de scoring sur cette reponse individuelle et met a jour le feedback + is_valid en base

**Drawer "Modifier le prompt" (panel lateral droit)**

Composant Sheet/Drawer shadcn qui s'ouvre a droite. Deux zones :

*Zone edition :*
- Selecteur de modele IA (gemini-2.5-flash, gemini-2.5-pro, gemini-2.0-flash, gemini-flash-latest)
- Textarea avec le prompt systeme actuel du sujet (pre-rempli)
- Bouton "Tester sur cette session" — relance l'evaluation IA sur toutes les reponses de la session avec le prompt modifie, affiche les resultats dans le drawer SANS sauvegarder en base

*Zone resultats (visible apres un test) :*
- Pour chaque question : titre condense, score (badge couleur), extrait du feedback
- Score global du test

*Zone sauvegarde :*
- Bouton "Sauvegarder le prompt sur le sujet" (vert) — persiste le prompt + modele modifies sur le sujet en base via `PUT /api/prompts/[id]`, puis met a jour les feedbacks de la session avec les resultats du dernier test
- Note explicative : "Met a jour le prompt du sujet et conserve les evaluations actuelles"

**Workflow d'iteration :**
1. Modifier le prompt dans le textarea
2. "Tester sur cette session" → voir les resultats dans le drawer
3. Ajuster le prompt, re-tester (autant de fois que necessaire)
4. "Sauvegarder le prompt sur le sujet" → persiste les changements

## API Routes

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
      "subject": { "id": "uuid", "code": "string" },
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
  "subject": { "id": "uuid", "code": "string", "prompt_id": "uuid" },
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
      "is_valid": true
    }
  ]
}
```

### `POST /api/sessions/[id]/reeval`

Relance l'evaluation IA sur une ou toutes les reponses.

**Body :**
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

Sauvegarde le prompt modifie sur le sujet et persiste les resultats du dernier test.

**Body :**
```json
{
  "prompt_text": "string",
  "model": "string",
  "test_results": [
    { "answer_id": "uuid", "ai_feedback": "string", "is_valid": true }
  ]
}
```

Met a jour le prompt via `PUT` sur la table `prompts` et ecrit les feedbacks dans la table `answers`.

## Composants

| Composant | Fichier | Role |
|-----------|---------|------|
| `SessionsPage` | `src/app/admin/sessions/page.tsx` | Page liste (server) |
| `SessionStats` | `src/components/admin/session-stats.tsx` | Cards KPI |
| `SessionTable` | `src/components/admin/session-table.tsx` | Tableau filtrable |
| `SessionDetailPage` | `src/app/admin/sessions/[id]/page.tsx` | Page detail (server) |
| `SessionDetail` | `src/components/admin/session-detail.tsx` | Contenu detail (client) |
| `AnswerCard` | `src/components/admin/answer-card.tsx` | Card question/reponse/feedback |
| `PromptDrawer` | `src/components/admin/prompt-drawer.tsx` | Drawer iteration prompt |

## Composant UI additionnel

Ajouter le composant **Sheet** de shadcn/ui pour le drawer :
```bash
npx shadcn@latest add sheet
```

## Navigation

Ajouter "Sessions" dans le `AdminShell` a cote de "Sujets" et "Prompts".

## Securite

- Les routes `/api/sessions/*` utilisent le client admin Supabase (service role) — pas de RLS a modifier
- Les pages `/admin/sessions/*` sont protegees par le middleware existant
- Pas de donnees sensibles supplementaires exposees (student_name est deja en base)

## Hors scope

- Pagination du tableau (a ajouter si le volume le justifie)
- Export CSV des sessions
- Graphiques d'evolution temporelle
- Correction manuelle par le prof (commentaires)
