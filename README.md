# Makana

Plateforme en ligne d'aide a la correction de sujets en Terminale STMG. L'IA Gemini analyse les reponses des eleves et les guide avec un score et des commentaires pedagogiques.

## Stack technique

- **Next.js 16** (App Router, TypeScript strict)
- **Supabase** (PostgreSQL + Auth)
- **Google Gemini 2.5 Flash** (analyse IA)
- **shadcn/ui + Tailwind CSS v4**
- **TipTap** (editeur WYSIWYG)
- **Zod** + **react-hook-form** (validation)

## Fonctionnalites

### Espace Admin (`/admin`)
- Authentification par email/mot de passe (Supabase Auth)
- Dashboard avec liste des sujets
- Creation/edition de sujets avec editeur WYSIWYG
- Import de PDF (extraction texte cote client)
- Generation automatique de codes d'acces (ex: `monk-horace-42`)

### Espace Eleve (`/`)
- Acces par code du sujet + prenom
- Affichage du texte de reference (HTML formate)
- Reponse question par question (soumission individuelle)
- Feedback IA avec score en pourcentage (0-100%)
- Possibilite de modifier et resoumettre chaque reponse

## Installation

```bash
npm install
```

### Variables d'environnement

Creer un fichier `.env.local` :

```
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_anon_key
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key
GEMINI_API_KEY=votre_gemini_api_key
```

### Base de donnees

Executer la migration SQL dans votre projet Supabase :

```
supabase/migrations/001_initial_schema.sql
```

### Lancer en dev

```bash
npm run dev
```

### Deployer sur Vercel

```bash
npx vercel --prod
```

Configurer les variables d'environnement dans le dashboard Vercel.

## Structure du projet

```
src/
├── app/
│   ├── page.tsx                      # Accueil eleve
│   ├── sujet/[code]/page.tsx         # Vue sujet + reponses
│   ├── admin/
│   │   ├── login/page.tsx            # Login admin
│   │   ├── page.tsx                  # Dashboard
│   │   └── sujets/                   # Creation/edition
│   └── api/
│       ├── subjects/                 # CRUD sujets
│       └── submit/route.ts           # Soumission + analyse IA
├── components/
│   ├── ui/                           # shadcn/ui + WYSIWYG
│   ├── admin/                        # Composants admin
│   └── student/                      # Composants eleve
├── lib/
│   ├── supabase/                     # Clients Supabase
│   ├── gemini.ts                     # Client Gemini + prompt
│   ├── code-generator.ts             # Generation codes
│   └── schemas/                      # Schemas Zod
├── data/
│   ├── french-words.ts               # Mots pour les codes
│   └── interfaces/                   # Types TypeScript
└── middleware.ts                     # Protection routes admin
```
