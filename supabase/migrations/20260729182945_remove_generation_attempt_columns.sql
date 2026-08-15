alter table public.vocab_items
drop column if exists content_generation_attempt_version,
drop column if exists content_generation_attempted_at,
drop column if exists content_generation_error;
