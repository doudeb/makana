# CLAUDE.md - Makana

## Projet

Makana est une plateforme d'aide a la correction de sujets de droit en Terminale STMG. Deux espaces : admin (gestion sujets) et eleve (reponses + feedback IA).

## Commandes

- `npm run dev` : serveur de dev (port 3000)
- `npm run build` : build production
- `npx tsc --noEmit` : verification TypeScript (zero erreurs attendu)

## Architecture

- **Next.js 16 App Router** avec `src/` directory
- **TypeScript strict** : toujours verifier avec `npx tsc --noEmit`
- **Tailwind CSS v4** : plugins via `@plugin` dans globals.css (pas `@import`)
- **shadcn/ui** : composants dans `src/components/ui/`
- **Supabase** : 3 clients (browser, server SSR, admin service-role) dans `src/lib/supabase/`
- **Gemini 2.5 Flash** : client dans `src/lib/gemini.ts`

## Conventions

- Langue de l'interface : francais (sans accents dans le code)
- `lang="fr"` sur le HTML racine
- Routes admin protegees par middleware (`src/middleware.ts`)
- API routes dans `src/app/api/`
- Validation Zod dans `src/lib/schemas/`
- Types domaine dans `src/data/interfaces/`
- Codes d'acces sujets : format `mot1-mot2-nombre` (mots dans `src/data/french-words.ts`)

## Points d'attention

- Les pages admin utilisent `export const dynamic = "force-dynamic"` (pas de prerendu SSG)
- Le texte de reference est stocke en HTML (editeur TipTap). Le rendu cote eleve utilise `dangerouslySetInnerHTML` dans le Server Component pour eviter l'echappement RSC
- Le feedback IA utilise `react-markdown` pour le rendu dans le composant client
- La soumission des reponses est individuelle (question par question) avec un score 0-100%
- Les eleves peuvent toujours modifier et resoumettre leurs reponses

## Base de donnees

Migration : `supabase/migrations/001_initial_schema.sql`
Tables : `subjects`, `questions`, `submissions`, `answers`
RLS : lecture publique sur subjects/questions, insertion publique sur submissions/answers, ecriture admin sur subjects/questions
