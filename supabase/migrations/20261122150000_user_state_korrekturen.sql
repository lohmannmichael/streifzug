-- Corrected legs ("war zu Fuß / Rad / gefahren") per way, kept with the account (Bauplan 3, C2).
alter table public.user_state add column if not exists korrekturen jsonb not null default '{}'::jsonb;
