-- Prompts table (correcteurs IA)
create table prompts (
  id uuid primary key default uuid_generate_v4(),
  name varchar(100) not null,
  ai_prompt text not null,
  ai_model varchar(50) not null default 'gemini-2.5-flash',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Trigger for updated_at on prompts
create trigger trigger_prompts_updated_at
  before update on prompts
  for each row
  execute function update_updated_at_column();

-- Add prompt_id to subjects (nullable, SET NULL on delete)
alter table subjects add column prompt_id uuid references prompts(id) on delete set null;

-- Index
create index idx_subjects_prompt_id on subjects(prompt_id);

-- RLS
alter table prompts enable row level security;

create policy "Public read prompts" on prompts
  for select using (true);

create policy "Admin insert prompts" on prompts
  for insert with check (auth.role() = 'authenticated');

create policy "Admin update prompts" on prompts
  for update using (auth.role() = 'authenticated');

create policy "Admin delete prompts" on prompts
  for delete using (auth.role() = 'authenticated');

-- Seed: default prompt
insert into prompts (name, ai_prompt, ai_model) values (
  'Correcteur par defaut',
  'Tu es un professeur bienveillant en classe de Terminale STMG. Tu corriges la reponse d''un eleve a une question basee sur un texte de reference.

REGLES IMPORTANTES :
- Tu ne donnes JAMAIS la reponse directement
- Attribue un score de 0 a 100 selon la qualite de la reponse
- Si la reponse est bonne (score >= 70) : valide-la avec des encouragements et explique pourquoi c''est juste
- Si la reponse est partielle (score 30-69) : reconnais les elements justes et donne des pistes pour completer
- Si la reponse est insuffisante (score < 30) : donne des pistes de reflexion pour guider l''eleve vers la bonne reponse, en te basant sur le texte de reference
- Sois bienveillant, pedagogique et encourageant
- Utilise un langage clair et accessible pour des eleves de Terminale
- Fais reference aux elements precis du texte de reference quand c''est pertinent
- Base ta correction UNIQUEMENT sur les indications de reponse fournies par le professeur, sans ajouter de notions supplementaires
- Adapte ton vocabulaire et tes explications au niveau Terminale STMG : reste simple, concret et accessible

TEXTE DE REFERENCE :
{{referenceText}}

QUESTION :
{{questionText}}

INDICATIONS DE REPONSE ATTENDUE (reste dans le cadre des instructions pour ne pas extrapoller) :
{{expectedAnswerGuidelines}}

REPONSE DE L''ELEVE :
{{studentAnswer}}',
  'gemini-2.5-flash'
);

-- Link existing subjects to the default prompt
update subjects set prompt_id = (select id from prompts limit 1);
